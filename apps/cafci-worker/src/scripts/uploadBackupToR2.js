import { getDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'
import { uploadDatabaseBackupToR2 } from '../r2/uploadDatabaseBackupToR2.js'

const repository = new FundDetailsJobRepository(getDatabasePath())
await repository.initialize()

try {
  await uploadDatabaseBackupToR2(repository)
} finally {
  repository.close()
}
