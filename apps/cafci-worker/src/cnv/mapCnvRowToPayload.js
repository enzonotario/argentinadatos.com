import { buildFundSlug } from '../utils/buildFundSlug.js'
import { normalizarPayloadFondo } from '../utils/normalizarPayloadFondo.js'

function daysBetween(fromDate, toDate) {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`)
  const to = Date.parse(`${toDate}T00:00:00.000Z`)

  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return null
  }

  return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

/** Máximo ratio VCP permitido en una ventana corta (evita seeds VCP=1 vs ~1000). */
export const MAX_VCP_LOOKBACK_RATIO = 2
const LOOKBACK_TOLERANCE_DAYS = 4

/**
 * Retorno de período en % (estilo planilla CNV / fonditos), sin anualizar.
 */
export function periodReturnPercent(vcpNew, vcpOld) {
  if (
    typeof vcpNew !== 'number' ||
    typeof vcpOld !== 'number' ||
    !vcpOld ||
    !(vcpOld > 0)
  ) {
    return null
  }

  return Number((((vcpNew - vcpOld) / vcpOld) * 100).toFixed(4))
}

/**
 * Anualiza un retorno de período (%) al estilo TNA simple: (ret%/días)*365.
 * Útil para rankings de money market; no sustituye los campos de período CNV.
 */
export function annualizePeriodReturnPercent(periodPercent, days) {
  if (
    typeof periodPercent !== 'number' ||
    !Number.isFinite(periodPercent) ||
    !days ||
    days <= 0
  ) {
    return null
  }

  return Number(((periodPercent / days) * 365).toFixed(4))
}

/**
 * Anualiza un retorno VCP al estilo TNA simple: (ret/días)*365*100
 * Útil para rankings de money market; no usar para campos publicados de CNV.
 */
export function annualizeReturnPercent(vcpNew, vcpOld, days) {
  if (
    typeof vcpNew !== 'number' ||
    typeof vcpOld !== 'number' ||
    !vcpOld ||
    !days ||
    days <= 0
  ) {
    return null
  }

  const periodReturn = (vcpNew - vcpOld) / vcpOld
  return Number(((periodReturn / days) * 365 * 100).toFixed(4))
}

export function isPlausibleVcpPair(vcpNew, vcpOld) {
  if (typeof vcpNew !== 'number' || typeof vcpOld !== 'number') return false
  if (!(vcpNew > 0) || !(vcpOld > 0)) return false

  const ratio = vcpNew / vcpOld
  return (
    ratio >= 1 / MAX_VCP_LOOKBACK_RATIO && ratio <= MAX_VCP_LOOKBACK_RATIO
  )
}

function lookbackToleranceDays(targetDays) {
  return Math.max(LOOKBACK_TOLERANCE_DAYS, Math.ceil(targetDays * 0.1))
}

/**
 * Retornos de período (no anualizados) desde la serie de VCP:
 * 7D/30D/90D/180D/1Y rolling y YTD.
 *
 * Nota: la planilla CNV `unMes` es variación vs fin de mes previo (no 30D
 * rolling). Preferimos rolling cuando hay histórico; CNV queda como fallback.
 * `noventaDias`/`cientoOchentaDias` de CAFCI suelen venir anualizados — no
 * usarlos como período.
 *
 * Además expone `dias*` (días reales del lookback) y `tnaEstimada` (TNA
 * simple: unMes → 7D → variación diaria, alineada a esos días).
 */
export function computeRendimientosFromHistory({
  fecha,
  valorCuotaparte,
  variacionDiariaPct = null,
  variacionUnMesPct = null,
  variacionEnElAnioPct = null,
  variacionDoceMesesPct = null,
  history = [],
}) {
  const sorted = [...history]
    .filter(item => item?.fecha && item.valorCuotaparte != null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Filtrar seeds VCP inconsistentes respecto al VCP más reciente.
  const latest = sorted.length ? sorted[sorted.length - 1] : null
  const cleaned =
    latest && valorCuotaparte != null
      ? sorted.filter(item =>
          isPlausibleVcpPair(valorCuotaparte, item.valorCuotaparte),
        )
      : sorted.filter(item =>
          latest
            ? isPlausibleVcpPair(latest.valorCuotaparte, item.valorCuotaparte)
            : true,
        )

  const findNear = targetDays => {
    if (!fecha || valorCuotaparte == null) {
      return null
    }

    const toleranceDays = lookbackToleranceDays(targetDays)
    const targetTime =
      Date.parse(`${fecha}T00:00:00.000Z`) - targetDays * 24 * 60 * 60 * 1000

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const item of cleaned) {
      if (item.fecha >= fecha) {
        continue
      }

      const itemTime = Date.parse(`${item.fecha}T00:00:00.000Z`)
      const distance = Math.abs(itemTime - targetTime)

      if (distance < bestDistance) {
        best = item
        bestDistance = distance
      }
    }

    if (!best || bestDistance > toleranceDays * 24 * 60 * 60 * 1000) {
      return null
    }

    const days = daysBetween(best.fecha, fecha)
    // Fondo demasiado nuevo para esa ventana (p. ej. 10 días de vida ≠ 30D).
    if (!days || days < targetDays - toleranceDays) {
      return null
    }

    return {
      days,
      value: periodReturnPercent(valorCuotaparte, best.valorCuotaparte),
    }
  }

  const findYtd = () => {
    if (!fecha || valorCuotaparte == null) {
      return null
    }

    const yearStart = `${fecha.slice(0, 4)}-01-01`
    let baseline = null

    for (const item of cleaned) {
      if (item.fecha <= yearStart) {
        baseline = item
      } else {
        break
      }
    }

    if (!baseline || baseline.fecha >= fecha) {
      return null
    }

    const days = daysBetween(baseline.fecha, fecha)
    if (!days) {
      return null
    }

    return {
      days,
      value: periodReturnPercent(valorCuotaparte, baseline.valorCuotaparte),
    }
  }

  const seven = findNear(7)
  const thirty = findNear(30)
  const ninety = findNear(90)
  const oneEighty = findNear(180)
  const twelveMonths = findNear(365)
  const ytd = findYtd()

  // Rolling ~30D; CNV unMes (= vs fin de mes previo) solo como fallback.
  const unMesFromCnv =
    thirty == null && typeof variacionUnMesPct === 'number'
      ? variacionUnMesPct
      : null
  const unMes = thirty?.value ?? unMesFromCnv
  // Días reales del lookback VCP; si cae al unMes CNV se asume 30.
  const diasUnMes = thirty?.days ?? (unMesFromCnv != null ? 30 : null)

  const ultimos7Dias = seven?.value ?? null
  const diasUltimos7Dias = seven?.days ?? null
  const daily =
    typeof variacionDiariaPct === 'number' ? variacionDiariaPct : null

  const tnaEstimadaPick =
    unMes != null && diasUnMes != null
      ? {
          value: annualizePeriodReturnPercent(unMes, diasUnMes),
          days: diasUnMes,
          periodo: 'unMes',
        }
      : ultimos7Dias != null && diasUltimos7Dias != null
        ? {
            value: annualizePeriodReturnPercent(
              ultimos7Dias,
              diasUltimos7Dias,
            ),
            days: diasUltimos7Dias,
            periodo: 'ultimos7Dias',
          }
        : daily != null
          ? {
              value: annualizePeriodReturnPercent(daily, 1),
              days: 1,
              periodo: 'variacionDiariaPct',
            }
          : null

  return {
    valorCuotaparte: valorCuotaparte ?? null,
    variacionDiariaPct: daily,
    ultimos7Dias,
    diasUltimos7Dias,
    unMes,
    diasUnMes,
    noventaDias: ninety?.value ?? null,
    diasNoventaDias: ninety?.days ?? null,
    cientoOchentaDias: oneEighty?.value ?? null,
    diasCientoOchentaDias: oneEighty?.days ?? null,
    enElAnio:
      ytd?.value ??
      (typeof variacionEnElAnioPct === 'number' ? variacionEnElAnioPct : null),
    diasEnElAnio: ytd?.days ?? null,
    doceMeses:
      twelveMonths?.value ??
      (typeof variacionDoceMesesPct === 'number'
        ? variacionDoceMesesPct
        : null),
    diasDoceMeses: twelveMonths?.days ?? null,
    // TNA simple alineada a los días reales del lookback (unMes → 7D → 1D).
    tnaEstimada: tnaEstimadaPick?.value ?? null,
    tnaEstimadaDias: tnaEstimadaPick?.days ?? null,
    tnaEstimadaPeriodo: tnaEstimadaPick?.periodo ?? null,
  }
}

export function mapCnvRowToPayload(row, { fondoId, history = [] } = {}) {
  const resolvedFondoId =
    fondoId || row.fondoIdPadre || row.codigoCNV || row.claseId

  const rendimientos = computeRendimientosFromHistory({
    fecha: row.fecha,
    valorCuotaparte: row.valorCuotaparte,
    variacionDiariaPct: row.variacionDiariaPct,
    variacionUnMesPct: row.variacionUnMesPct,
    variacionEnElAnioPct: row.variacionEnElAnioPct,
    variacionDoceMesesPct: row.variacionDoceMesesPct,
    history,
  })

  const calificaciones = row.calificacion
    ? [
        {
          calificadora: null,
          calificacion: row.calificacion,
          fecha: row.fecha,
        },
      ]
    : []

  return normalizarPayloadFondo({
    fondoId: String(resolvedFondoId),
    claseId: String(row.claseId),
    slug: buildFundSlug({
      nombre: row.nombre,
      fondoId: resolvedFondoId,
      claseId: row.claseId,
    }),
    nombre: row.nombre,
    fecha: row.fecha,
    administradora: row.administradora,
    depositaria: row.depositaria,
    tipoRenta: row.tipoRenta,
    tipoDD: row.tipoDD,
    region: row.region,
    horizonte: row.horizonte,
    moneda: row.moneda,
    codigoCNV: row.codigoCNV,
    patrimonio: row.patrimonio,
    cantidadCuotapartes: row.cantidadCuotapartes,
    inversionMinima: row.inversionMinima,
    monedaInversion: row.moneda,
    plazoLiquidacionDias: row.plazoLiquidacionDias,
    rendimientos,
    calificaciones,
    honorarios: {
      honorarioGerente: row.honorarioGerente,
      honorarioDepositaria: row.honorarioDepositaria,
      comisionIngreso: row.comisionIngreso,
      comisionEgreso: row.comisionEgreso,
      comisionTransferencia: row.comisionTransferencia,
      gastosOrdinariosGestion: row.gastosOrdinariosGestion,
      comisionExito: row.comisionExito,
    },
    sociedades: [
      row.administradora
        ? { tipo: 'Administradora', nombre: row.administradora, logo: null }
        : null,
      row.depositaria
        ? { tipo: 'Depositaria', nombre: row.depositaria, logo: null }
        : null,
    ].filter(Boolean),
  })
}
