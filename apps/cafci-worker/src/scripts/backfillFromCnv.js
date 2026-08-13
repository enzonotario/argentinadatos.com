import { getDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'
import { FundDetailsSyncService } from '../services/fundDetailsSyncService.js'
import { uploadDatabaseBackupToR2 } from '../r2/uploadDatabaseBackupToR2.js'

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    from: null,
    to: null,
    upload: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === '--from') {
      args.from = argv[index + 1]
      index += 1
      continue
    }

    if (value === '--to') {
      args.to = argv[index + 1]
      index += 1
      continue
    }

    if (value === '--upload') {
      args.upload = true
    }
  }

  if (!args.from || !args.to) {
    throw new Error(
      'Uso: node src/scripts/backfillFromCnv.js --from YYYY-MM-DD --to YYYY-MM-DD [--upload]',
    )
  }

  return args
}

const { from, to, upload } = parseArgs()
const repository = new FundDetailsJobRepository(getDatabasePath())
await repository.initialize()

try {
  const service = new FundDetailsSyncService(repository)
  const summary = await service.backfill({ fromDate: from, toDate: to })
  console.log('[cafci-worker] CNV backfill completed', {
    from: summary.fromDate,
    to: summary.toDate,
    days: summary.days,
    ingested: summary.ingested,
    currentFunds: summary.currentFunds,
  })

  if (upload) {
    await uploadDatabaseBackupToR2(repository)
  }
} finally {
  repository.close()
}
