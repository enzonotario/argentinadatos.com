import {
  guardarDetalleFondo,
  guardarHistoricoFondo,
  guardarListaFondos,
} from '@/finanzas/fci/fondos/guardado/guardarDetallesFondos.js'
import { guardarComparatasas } from '@/finanzas/fci/fondos/guardado/guardarComparatasas.js'
import { guardarSeriesDesdeFondos } from '@/finanzas/fci/series/guardarSeriesDesdeFondos.js'
import { recuperarYLocalizarCamposFondo } from '@/finanzas/fci/fondos/preservarComposicionCartera.js'
import { FciFondosDatabaseService } from '@/finanzas/fci/fondos/database/service.js'
import { logError, logGrupo, logMensaje } from '@/log.js'

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

    const recuperacion = await recuperarYLocalizarCamposFondo(
      fondos,
      db.dbPath,
    )

    if (recuperacion.recuperados > 0 || recuperacion.logosLocalizados > 0) {
      logMensaje(log, 'Campos CAFCI recuperados/localizados', recuperacion)
    }

    const historicosPorSlug = {}

    for (const fondo of fondos) {
      const historico = db.obtenerHistorialPorSlug(fondo.slug)
      historicosPorSlug[fondo.slug] = historico

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
