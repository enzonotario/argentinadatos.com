import { getDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'
import { formatJobsCleared } from './formatJobsOutput.js'
import { parseJobsCliArgs, resolveExecutionDate } from './jobsCliArgs.js'

const cliArgs = parseJobsCliArgs()
const repository = new FundDetailsJobRepository(getDatabasePath())
await repository.initialize()

try {
  const deleted = repository.clearJobs({
    all: cliArgs.all,
    executionDate: resolveExecutionDate(cliArgs),
  })

  console.log(
    formatJobsCleared({
      databasePath: repository.databasePath,
      scope: cliArgs.all ? 'all' : resolveExecutionDate(cliArgs),
      deleted,
    }),
  )
} finally {
  repository.close()
}
