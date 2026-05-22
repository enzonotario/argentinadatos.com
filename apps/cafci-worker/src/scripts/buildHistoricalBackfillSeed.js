import { buildHistoricalBackfillSeed } from '../history/buildHistoricalBackfillSeed.js'

const result = await buildHistoricalBackfillSeed()

console.log('[cafci-worker] historical backfill seed built', result)
