import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getR2Config, isR2BackupConfigured } from '../config.js'
import { downloadDatabaseBackupFromR2 } from '../r2/downloadDatabaseBackupFromR2.js'

export async function importHistoricalBackfillSeedFromR2(repository) {
  if (repository.countHistoricalSnapshots() > 0 || !isR2BackupConfigured()) {
    return 0
  }

  const tempPath = join(tmpdir(), `cafci-worker-backfill-seed-${process.pid}.sqlite`)
  const config = getR2Config()

  try {
    const downloaded = await downloadDatabaseBackupFromR2({
      destinationPath: tempPath,
      objectKey: config.backfillObjectKey,
      failIfMissing: false,
    })

    if (!downloaded || !existsSync(tempPath)) {
      return 0
    }

    const imported = repository.importHistoricalBackfillFromDatabase(tempPath)

    if (imported > 0) {
      console.log('[cafci-worker] imported historical backfill seed from R2', {
        imported,
        bucket: config.bucket,
        objectKey: config.backfillObjectKey,
      })
    }

    return imported
  } finally {
    rmSync(tempPath, {
      recursive: true,
      force: true,
    })
  }
}
