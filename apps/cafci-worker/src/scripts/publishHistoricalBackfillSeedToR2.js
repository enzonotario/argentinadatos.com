import { getBackfillSeedDatabasePath, getR2Config } from '../config.js'
import { buildHistoricalBackfillSeed } from '../history/buildHistoricalBackfillSeed.js'
import { uploadFileToR2 } from '../r2/uploadDatabaseBackupToR2.js'

const result = await buildHistoricalBackfillSeed({
  databasePath: getBackfillSeedDatabasePath(),
})

await uploadFileToR2({
  filePath: result.databasePath,
  objectKey: getR2Config().backfillObjectKey,
  metadata: {
    kind: 'historical-backfill-seed',
  },
})

console.log('[cafci-worker] historical backfill seed published', {
  ...result,
  objectKey: getR2Config().backfillObjectKey,
})
