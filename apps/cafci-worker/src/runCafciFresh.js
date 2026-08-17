import { rmSync } from 'node:fs'
import { getDatabasePath } from './config.js'
import { FundDetailsJobRepository } from './database/fundDetailsJobRepository.js'
import { FundDetailsSyncService } from './services/fundDetailsSyncService.js'
import { uploadDatabaseBackupToR2 } from './r2/uploadDatabaseBackupToR2.js'

export function parseFreshArgs(argv = process.argv.slice(2)) {
  const args = {
    fromDate: null,
    toDate: null,
    delayMs: 0,
    upload: false,
    keepDb: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === '--from') {
      args.fromDate = argv[index + 1]
      index += 1
      continue
    }

    if (value === '--to') {
      args.toDate = argv[index + 1]
      index += 1
      continue
    }

    if (value === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] || 0)
      index += 1
      continue
    }

    if (value === '--upload') {
      args.upload = true
      continue
    }

    if (value === '--keep-db') {
      args.keepDb = true
    }
  }

  if (Number.isNaN(args.delayMs) || args.delayMs < 0) {
    throw new Error('--delay-ms debe ser un número >= 0')
  }

  return args
}

export function resetSqliteFiles(databasePath) {
  for (const path of [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ]) {
    rmSync(path, { force: true })
  }
}

export async function runCafciFresh({
  fromDate = null,
  toDate = null,
  delayMs = 0,
  upload = false,
  keepDb = false,
  databasePath = getDatabasePath(),
} = {}) {
  if (!keepDb) {
    resetSqliteFiles(databasePath)
  }

  const repository = new FundDetailsJobRepository(databasePath)
  await repository.initialize()

  try {
    const service = new FundDetailsSyncService(repository)
    const summary = await service.fresh({ fromDate, toDate, delayMs })

    console.log('[cafci-worker] CNV fresh completed', {
      from: summary.fromDate,
      to: summary.toDate,
      days: summary.days,
      ingested: summary.ingested,
      currentFunds: summary.currentFunds,
      databasePath,
      reset: !keepDb,
    })

    if (upload) {
      await uploadDatabaseBackupToR2(repository)
    }

    return summary
  } finally {
    repository.close()
  }
}
