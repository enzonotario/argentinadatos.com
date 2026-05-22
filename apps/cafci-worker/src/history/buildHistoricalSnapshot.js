import { buildFundSlug } from '../utils/buildFundSlug.js'
import {
  inferHistoryCategoryKey,
  inferHistoryCategoryLabel,
} from './historyCategories.js'

function roundMetric(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null
  }

  return Number(value.toFixed(6))
}

function normalizeAum(value) {
  return typeof value === 'number' && value > 0 ? value : null
}

export function buildHistoricalSnapshot(input, context = {}) {
  const slug =
    input.slug ||
    buildFundSlug({
      name: input.name,
      fundId: input.fundId || 'unknown',
      classId: input.classId || 'unknown',
    })

  const shareValue =
    typeof input.shareValue === 'number' && !Number.isNaN(input.shareValue)
      ? input.shareValue
      : null
  const assetsUnderManagement = normalizeAum(input.assetsUnderManagement)
  const firstShareValue =
    context.firstSnapshot?.shareValue ?? shareValue ?? null
  const previousShareValue = context.previousSnapshot?.shareValue ?? null
  const previousAum = context.previousSnapshot?.assetsUnderManagement ?? null

  const dailyReturn =
    shareValue !== null && previousShareValue && previousShareValue !== 0
      ? roundMetric(
          ((shareValue - previousShareValue) / previousShareValue) * 100,
        )
      : null

  const cumulativeReturn =
    shareValue !== null && firstShareValue && firstShareValue !== 0
      ? roundMetric(((shareValue - firstShareValue) / firstShareValue) * 100)
      : shareValue !== null
        ? 0
        : null

  const estimatedNetFlow =
    assetsUnderManagement !== null &&
    previousAum !== null &&
    dailyReturn !== null
      ? roundMetric(
          assetsUnderManagement - previousAum * (1 + dailyReturn / 100),
        )
      : null

  const categoryKey =
    input.categoryKey || inferHistoryCategoryKey(input.categoryLabel) || null
  const categoryLabel =
    input.categoryLabel || inferHistoryCategoryLabel(categoryKey) || null

  return {
    slug,
    fundId: input.fundId ?? null,
    classId: input.classId ?? null,
    name: input.name,
    sourceDate: input.sourceDate,
    categoryKey,
    categoryLabel,
    horizon: input.horizon ?? null,
    shareValue,
    assetsUnderManagement,
    dailyReturn,
    cumulativeReturn,
    estimatedNetFlow,
    sourceKind: input.sourceKind,
    rawSource: input.rawSource ?? null,
  }
}
