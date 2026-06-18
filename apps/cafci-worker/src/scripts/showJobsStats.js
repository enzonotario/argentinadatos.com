import { getDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'
import { formatJobsStats } from './formatJobsOutput.js'
import { parseJobsCliArgs } from './jobsCliArgs.js'

const { date } = parseJobsCliArgs()
const repository = new FundDetailsJobRepository(getDatabasePath())
await repository.initialize()

try {
  const stats = repository.getJobsStats(
    date ? { executionDate: date } : undefined,
  )

  console.log(formatJobsStats(stats))
} finally {
  repository.close()
}
