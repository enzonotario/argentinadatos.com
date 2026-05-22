import { existsSync, statSync } from 'node:fs'
import { getDatabasePath, isR2BackupConfigured } from './config.js'
import { FundDetailsJobRepository } from './database/fundDetailsJobRepository.js'
import { downloadDatabaseBackupFromR2 } from './r2/downloadDatabaseBackupFromR2.js'
import { uploadDatabaseBackupToR2 } from './r2/uploadDatabaseBackupToR2.js'
import { FundDetailsSyncService } from './services/fundDetailsSyncService.js'

const args = new Set(process.argv.slice(2))
const watchMode = args.has('--watch')
const forceRetryFailed = args.has('--force')
const databasePath = getDatabasePath()

let downloadedBackup = null

if (!existsSync(databasePath) && isR2BackupConfigured()) {
  downloadedBackup = await downloadDatabaseBackupFromR2({
    destinationPath: databasePath,
    failIfMissing: false,
  })
}

const repository = new FundDetailsJobRepository(databasePath)
await repository.initialize()

if (
  watchMode &&
  isR2BackupConfigured() &&
  !repository.getWorkerState('last_r2_backup_at')
) {
  repository.setWorkerState(
    'last_r2_backup_at',
    downloadedBackup?.uploadedAt ||
      downloadedBackup?.lastModified ||
      statSync(databasePath).mtime.toISOString() ||
      new Date().toISOString(),
  )
}

const shutdown = () => {
  try {
    repository.close()
  } finally {
    process.exit(0)
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

const service = new FundDetailsSyncService(repository)

try {
  if (watchMode) {
    console.log('[cafci-worker] starting daemon mode', {
      databasePath: repository.databasePath,
    })
    await service.startPolling({ forceRetryFailed })
  } else {
    const summary = await service.runCycle({ forceRetryFailed })
    await uploadDatabaseBackupToR2(repository)
    console.log('[cafci-worker] run completed', summary)
  }
} finally {
  repository.close()
}
