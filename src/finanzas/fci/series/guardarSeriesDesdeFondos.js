import { format, parseISO } from 'date-fns'
import { escribirRuta } from '@/utils/rutas.js'
import { logError, logGrupo, logMensaje } from '@/log.js'
import {
  emptyFciSeries,
  FCI_SERIES,
  inferSerieKey,
} from './seriesCategories.js'
import {
  mapFondoToSerieItem,
  mapHistoricoToSerieItem,
} from './mapFondoToSerieItem.js'

function findPenultimoSnapshot(historico, fechaActual) {
  if (!fechaActual || !Array.isArray(historico) || historico.length === 0) {
    return null
  }

  let best = null

  for (const snapshot of historico) {
    if (!snapshot?.fecha || snapshot.fecha >= fechaActual) {
      continue
    }

    if (!best || snapshot.fecha > best.fecha) {
      best = snapshot
    }
  }

  return best
}

/**
 * Escribe las series FCI (diario / ultimo / penultimo) desde el snapshot SQLite.
 */
export async function guardarSeriesDesdeFondos(fondos, historicosPorSlug = {}) {
  const log = logGrupo({
    fuente: 'guardarSeriesDesdeFondos',
    tipo: 'fciFondos',
  })

  try {
    const ultimo = emptyFciSeries()
    const penultimo = emptyFciSeries()
    const porFecha = new Map()

    for (const fondo of fondos) {
      const serie =
        inferSerieKey(fondo.tipoRenta) ||
        inferSerieKey(historicosPorSlug[fondo.slug]?.at(-1)?.categoria)

      if (!serie || !fondo.nombre || !fondo.fecha) {
        continue
      }

      const item = mapFondoToSerieItem(fondo)
      ultimo[serie].push(item)

      if (!porFecha.has(item.fecha)) {
        porFecha.set(item.fecha, emptyFciSeries())
      }
      porFecha.get(item.fecha)[serie].push(item)

      const prev = findPenultimoSnapshot(
        historicosPorSlug[fondo.slug] || [],
        fondo.fecha,
      )

      if (prev) {
        penultimo[serie].push(mapHistoricoToSerieItem(prev))
      }
    }

    for (const [fecha, series] of porFecha.entries()) {
      const fechaConBarra = format(parseISO(fecha), 'yyyy/MM/dd')

      for (const serie of FCI_SERIES) {
        if (series[serie].length === 0) {
          continue
        }

        await escribirRuta(
          `/finanzas/fci/${serie}/${fechaConBarra}`,
          series[serie],
        )
      }
    }

    for (const serie of FCI_SERIES) {
      if (ultimo[serie].length > 0) {
        await escribirRuta(`/finanzas/fci/${serie}/ultimo`, ultimo[serie])
      }

      if (penultimo[serie].length > 0) {
        await escribirRuta(
          `/finanzas/fci/${serie}/penultimo`,
          penultimo[serie],
        )
      }
    }

    const resumen = Object.fromEntries(
      FCI_SERIES.map(serie => [serie, ultimo[serie].length]),
    )

    logMensaje(log, 'Series FCI generadas desde SQLite', resumen)

    return resumen
  } catch (error) {
    logError(log, error)
    return null
  }
}
