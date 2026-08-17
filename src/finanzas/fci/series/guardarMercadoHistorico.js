import { escribirRuta } from '@/utils/rutas.js'
import { FCI_SERIES, inferSerieKey } from './seriesCategories.js'

function emptyTypePoint() {
  return {
    clases: 0,
    conPatrimonio: 0,
    patrimonio: 0,
    conFlujo: 0,
    flujoEstimado: 0,
  }
}

function emptyDay() {
  return {
    ...emptyTypePoint(),
    byType: Object.fromEntries(FCI_SERIES.map(key => [key, emptyTypePoint()])),
  }
}

/**
 * Compacta los históricos por clase en una serie diaria de AUM / flujo estimado.
 */
export function aggregateMercadoHistorico(historicosPorSlug = {}) {
  const byDate = new Map()

  for (const snapshots of Object.values(historicosPorSlug)) {
    if (!Array.isArray(snapshots)) {
      continue
    }

    for (const snapshot of snapshots) {
      const fecha = snapshot?.fecha
      if (!fecha) {
        continue
      }

      let day = byDate.get(fecha)
      if (!day) {
        day = emptyDay()
        byDate.set(fecha, day)
      }

      day.clases += 1
      const serie =
        (snapshot.categoriaKey && FCI_SERIES.includes(snapshot.categoriaKey)
          ? snapshot.categoriaKey
          : inferSerieKey(snapshot.categoria)) || null
      const bucket = serie ? day.byType[serie] : null
      if (bucket) {
        bucket.clases += 1
      }

      if (typeof snapshot.patrimonio === 'number' && snapshot.patrimonio > 0) {
        day.patrimonio += snapshot.patrimonio
        day.conPatrimonio += 1
        if (bucket) {
          bucket.patrimonio += snapshot.patrimonio
          bucket.conPatrimonio += 1
        }
      }

      if (
        typeof snapshot.flujoEstimado === 'number' &&
        Number.isFinite(snapshot.flujoEstimado)
      ) {
        day.flujoEstimado += snapshot.flujoEstimado
        day.conFlujo += 1
        if (bucket) {
          bucket.flujoEstimado += snapshot.flujoEstimado
          bucket.conFlujo += 1
        }
      }
    }
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fecha, day]) => ({
      fecha,
      clases: day.clases,
      conPatrimonio: day.conPatrimonio,
      patrimonio: day.patrimonio,
      conFlujo: day.conFlujo,
      flujoEstimado: day.flujoEstimado,
      byType: day.byType,
    }))
}

export async function guardarMercadoHistorico(
  historicosPorSlug,
  fechaActualizacion = null,
) {
  const puntos = aggregateMercadoHistorico(historicosPorSlug)
  await escribirRuta('/finanzas/fci/mercado/historico', {
    fechaActualizacion,
    puntos,
  })
  return { dias: puntos.length }
}
