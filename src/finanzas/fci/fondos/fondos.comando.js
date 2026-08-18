import {
  guardarDetalleFondo,
  guardarHistoricoFondo,
  guardarListaFondos,
} from '@/finanzas/fci/fondos/guardado/guardarDetallesFondos.js'
import { guardarComparatasas } from '@/finanzas/fci/fondos/guardado/guardarComparatasas.js'
import { guardarSeriesDesdeFondos } from '@/finanzas/fci/series/guardarSeriesDesdeFondos.js'
import { guardarMercadoHistorico } from '@/finanzas/fci/series/guardarMercadoHistorico.js'
import { recuperarYLocalizarCamposFondo } from '@/finanzas/fci/fondos/preservarComposicionCartera.js'
import { FciFondosDatabaseService } from '@/finanzas/fci/fondos/database/service.js'
import { clavesSlugFondo } from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'
import { computeRendimientosFromHistory } from '../../../../apps/cafci-worker/src/cnv/mapCnvRowToPayload.js'
import { logError, logGrupo, logMensaje } from '@/log.js'

/**
 * Recomputa retornos de período rolling desde el histórico (unMes = ~30D).
 * Evita servir la columna CNV “vs fin de mes previo” como si fuera 30D.
 */
function applyRollingRendimientos(fondo, historico) {
  if (!fondo?.rendimientos) {
    return fondo
  }

  const history = (historico || [])
    .filter(item => item?.fecha && item.valorCuotaparte != null)
    .filter(item => !fondo.fecha || item.fecha < fondo.fecha)
    .map(item => ({
      fecha: item.fecha,
      valorCuotaparte: item.valorCuotaparte,
    }))

  const recomputed = computeRendimientosFromHistory({
    fecha: fondo.fecha,
    valorCuotaparte: fondo.rendimientos.valorCuotaparte,
    variacionDiariaPct: fondo.rendimientos.variacionDiariaPct,
    // Fallbacks CNV / valores previos si falta ventana en el histórico.
    variacionUnMesPct: fondo.rendimientos.unMes,
    variacionEnElAnioPct: fondo.rendimientos.enElAnio,
    variacionDoceMesesPct: fondo.rendimientos.doceMeses,
    history,
  })

  fondo.rendimientos = {
    ...fondo.rendimientos,
    ...recomputed,
  }

  return fondo
}

export default async function fondosComando() {
  const log = logGrupo({
    comando: 'fciFondos',
    fuente: 'sqlite',
  })

  try {
    const db = new FciFondosDatabaseService()
    const snapshot = db.obtenerSnapshotActual()

    if (!snapshot || snapshot.fondos.length === 0) {
      logMensaje(log, 'No se encontraron fondos detallados en SQLite', {
        dbPath: db.dbPath,
      })
      return false
    }

    const fondos = [...snapshot.fondos].sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es'),
    )

    const recuperacion = await recuperarYLocalizarCamposFondo(fondos, db.dbPath)

    if (recuperacion.recuperados > 0 || recuperacion.logosLocalizados > 0) {
      logMensaje(log, 'Campos CAFCI recuperados/localizados', recuperacion)
    }

    const historicosPorSlug = {}

    for (const fondo of fondos) {
      const claves = clavesSlugFondo(fondo)
      const historico = db.obtenerHistorialPorSlugs(claves)
      for (const clave of claves) {
        historicosPorSlug[clave] = historico
      }
      applyRollingRendimientos(fondo, historico)

      guardarDetalleFondo(fondo)
      guardarHistoricoFondo(fondo, historico, snapshot.fechaActualizacion)
    }

    await guardarListaFondos({
      fechaActualizacion: snapshot.fechaActualizacion,
      fondos,
    })

    await guardarComparatasas({
      fechaActualizacion: snapshot.fechaActualizacion,
      fondos,
    })

    await guardarSeriesDesdeFondos(fondos, historicosPorSlug)
    await guardarMercadoHistorico(
      historicosPorSlug,
      snapshot.fechaActualizacion,
    )

    logMensaje(log, 'Fondos detallados generados desde SQLite', {
      cantidad: fondos.length,
      fechaActualizacion: snapshot.fechaActualizacion,
      ...recuperacion,
    })

    return true
  } catch (error) {
    logError(log, error)
    return false
  }
}
