import { buildHistoricalSnapshot } from './buildHistoricalSnapshot.js'
import {
  inferHistoryCategoryKey,
  inferHistoryCategoryLabel,
} from './historyCategories.js'

export async function recordHistoricalSnapshotFromDetail(repository, detail) {
  const fecha = detail.fecha

  if (!fecha) {
    return null
  }

  const categoriaKey = inferHistoryCategoryKey(detail.tipoRenta)
  const firstSnapshot = repository.getFirstHistoricalSnapshot(detail.slug)
  const previousSnapshot = repository.getLatestHistoricalSnapshotBefore(
    detail.slug,
    fecha,
  )

  const snapshot = buildHistoricalSnapshot(
    {
      slug: detail.slug,
      fondoId: detail.fondoId ?? null,
      claseId: detail.claseId ?? null,
      nombre: detail.nombre,
      fecha,
      categoriaKey,
      categoria: inferHistoryCategoryLabel(categoriaKey) || detail.tipoRenta,
      horizonte: detail.horizonte ?? null,
      valorCuotaparte: detail.rendimientos?.valorCuotaparte ?? null,
      patrimonio: detail.patrimonio ?? null,
      origen: 'cafci-detail',
      fuenteOriginal: detail,
    },
    {
      firstSnapshot,
      previousSnapshot,
    },
  )

  repository.upsertHistoricalSnapshot(snapshot)

  return snapshot
}
