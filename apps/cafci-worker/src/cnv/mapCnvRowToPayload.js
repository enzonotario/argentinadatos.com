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
 * Anualiza un retorno de período al estilo CAFCI (%): (ret/días)*365*100
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

export function computeRendimientosFromHistory({
  fecha,
  valorCuotaparte,
  variacionDiariaPct = null,
  history = [],
}) {
  const sorted = [...history]
    .filter(item => item?.fecha && item.valorCuotaparte != null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const findNear = targetDays => {
    if (!fecha || valorCuotaparte == null) {
      return null
    }

    const targetTime =
      Date.parse(`${fecha}T00:00:00.000Z`) - targetDays * 24 * 60 * 60 * 1000

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const item of sorted) {
      if (item.fecha >= fecha) {
        continue
      }

      if (!isPlausibleVcpPair(valorCuotaparte, item.valorCuotaparte)) {
        continue
      }

      const itemTime = Date.parse(`${item.fecha}T00:00:00.000Z`)
      const distance = Math.abs(itemTime - targetTime)

      if (distance < bestDistance) {
        best = item
        bestDistance = distance
      }
    }

    // No aceptar puntos demasiado lejos del target (±4 días).
    if (
      !best ||
      bestDistance > LOOKBACK_TOLERANCE_DAYS * 24 * 60 * 60 * 1000
    ) {
      return null
    }

    const days = daysBetween(best.fecha, fecha)
    // Fondo demasiado nuevo para esa ventana (p. ej. 10 días de vida ≠ 30D).
    if (!days || days < targetDays - LOOKBACK_TOLERANCE_DAYS) {
      return null
    }

    return {
      days,
      value: annualizeReturnPercent(
        valorCuotaparte,
        best.valorCuotaparte,
        days,
      ),
    }
  }

  const seven = findNear(7)
  const thirty = findNear(30)

  const fromDaily =
    typeof variacionDiariaPct === 'number'
      ? Number((variacionDiariaPct * 365).toFixed(4))
      : null

  return {
    valorCuotaparte: valorCuotaparte ?? null,
    ultimos7Dias: seven?.value ?? fromDaily,
    unMes: thirty?.value ?? seven?.value ?? fromDaily,
    noventaDias: null,
    cientoOchentaDias: null,
    enElAnio: null,
    doceMeses: null,
  }
}

export function mapCnvRowToPayload(row, { fondoId, history = [] } = {}) {
  const resolvedFondoId =
    fondoId || row.fondoIdPadre || row.codigoCNV || row.claseId

  const rendimientos = computeRendimientosFromHistory({
    fecha: row.fecha,
    valorCuotaparte: row.valorCuotaparte,
    variacionDiariaPct: row.variacionDiariaPct,
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
