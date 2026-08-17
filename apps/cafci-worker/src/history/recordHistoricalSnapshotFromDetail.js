import { buildHistoricalSnapshot } from './buildHistoricalSnapshot.js'
import {
  inferHistoryCategoryKey,
  inferHistoryCategoryLabel,
} from './historyCategories.js'

export function recordHistoricalSnapshotFromDetailSync(
  repository,
  detail,
  { firstSnapshot, previousSnapshot, persistFuenteOriginal = true } = {},
) {
  const fecha = detail.fecha

  if (!fecha) {
    return null
  }

  const categoriaKey = inferHistoryCategoryKey(detail.tipoRenta)
  const resolvedFirst =
    firstSnapshot === undefined
      ? repository.getFirstHistoricalSnapshot(detail.slug)
      : firstSnapshot
  const resolvedPrevious =
    previousSnapshot === undefined
      ? repository.getLatestHistoricalSnapshotBefore(detail.slug, fecha)
      : previousSnapshot

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
      origen: detail.origen || 'cnv-excel',
      fuenteOriginal: persistFuenteOriginal ? detail : null,
    },
    {
      firstSnapshot: resolvedFirst,
      previousSnapshot: resolvedPrevious,
    },
  )

  repository.upsertHistoricalSnapshot(snapshot)

  return snapshot
}

export async function recordHistoricalSnapshotFromDetail(
  repository,
  detail,
  options,
) {
  return recordHistoricalSnapshotFromDetailSync(repository, detail, options)
}
