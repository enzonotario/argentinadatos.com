import { buildHistoricalSnapshot } from './buildHistoricalSnapshot.js'
import {
  inferHistoryCategoryKey,
  inferHistoryCategoryLabel,
} from './historyCategories.js'

export async function recordHistoricalSnapshotFromDetail(repository, detail) {
  const sourceDate = detail.date || detail.fecha

  if (!sourceDate) {
    return null
  }

  const categoryKey = inferHistoryCategoryKey(
    detail.incomeType || detail.tipoRenta,
  )
  const firstSnapshot = repository.getFirstHistoricalSnapshot(detail.slug)
  const previousSnapshot = repository.getLatestHistoricalSnapshotBefore(
    detail.slug,
    sourceDate,
  )

  const snapshot = buildHistoricalSnapshot(
    {
      slug: detail.slug,
      fundId: detail.fundId ?? detail.fondoId ?? null,
      classId: detail.classId ?? detail.claseId ?? null,
      name: detail.name ?? detail.nombre,
      sourceDate,
      categoryKey,
      categoryLabel:
        inferHistoryCategoryLabel(categoryKey) ||
        detail.incomeType ||
        detail.tipoRenta,
      horizon: detail.horizon ?? detail.horizonte ?? null,
      shareValue:
        detail.performance?.shareValue ??
        detail.rendimientos?.valorCuotaparte ??
        null,
      assetsUnderManagement:
        detail.assetsUnderManagement ?? detail.patrimonio ?? null,
      sourceKind: 'cafci-detail',
      rawSource: detail,
    },
    {
      firstSnapshot,
      previousSnapshot,
    },
  )

  repository.upsertHistoricalSnapshot(snapshot)

  return snapshot
}
