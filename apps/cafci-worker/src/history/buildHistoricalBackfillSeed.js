import { existsSync, rmSync } from 'node:fs'
import { getBackfillSeedDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'
import { backfillHistoricalSnapshots } from './backfillHistoricalSnapshots.js'

export async function buildHistoricalBackfillSeed({
  databasePath = getBackfillSeedDatabasePath(),
} = {}) {
  if (existsSync(databasePath)) {
    rmSync(databasePath, {
      force: true,
    })
  }

  const repository = new FundDetailsJobRepository(databasePath)
  await repository.initialize()

  try {
    const imported = await backfillHistoricalSnapshots(repository)

    return {
      databasePath,
      imported,
    }
  } finally {
    repository.close()
  }
}
