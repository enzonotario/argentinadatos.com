import {
  guardarDetalleFondo,
  guardarHistoricoFondo,
  guardarListaFondos,
} from '@/finanzas/fci/fondos/guardado/guardarDetallesFondos.js'
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

    for (const fondo of fondos) {
      guardarDetalleFondo(fondo)
      guardarHistoricoFondo(
        fondo,
        db.obtenerHistorialPorSlug(fondo.slug),
        snapshot.fechaActualizacion,
      )
    }

    await guardarListaFondos({
      fechaActualizacion: snapshot.fechaActualizacion,
      fondos,
    })

    logMensaje(log, 'Fondos detallados generados desde SQLite', {
      cantidad: fondos.length,
      fechaActualizacion: snapshot.fechaActualizacion,
    })

    return true
  } catch (error) {
    logError(log, error)
    return false
  }
}
