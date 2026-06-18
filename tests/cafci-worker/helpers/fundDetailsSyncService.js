import { expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FundDetailsJobRepository } from '../../../apps/cafci-worker/src/database/fundDetailsJobRepository.js'
import { fetchFundsCatalog } from '../../../apps/cafci-worker/src/cafci/cafciClient.js'
import { FundDetailsSyncService } from '../../../apps/cafci-worker/src/services/fundDetailsSyncService.js'

export function todayExecutionDate() {
  return new Date().toISOString().slice(0, 10)
}

export async function createTempRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'cafci-sync-service-'))
  const dbPath = join(directory, 'db.sqlite')
  const repository = new FundDetailsJobRepository(dbPath)
  await repository.initialize()

  return {
    repository,
    cleanup: () => {
      repository.close()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}

export async function fetchSampleFunds(limit = 2) {
  const catalog = await fetchFundsCatalog()
  return catalog.slice(0, limit)
}

export function createPendingJobs(repository, executionDate, funds) {
  repository.createJobsForDate(executionDate, funds)

  return funds.map(fund => {
    const job = repository
      .getPendingJobs(executionDate)
      .find(
        entry =>
          entry.fund_id === fund.fondoId && entry.class_id === fund.claseId,
      )

    if (!job) {
      throw new Error(
        `No se encontró job pendiente para ${fund.fondoId}/${fund.claseId}`,
      )
    }

    return job
  })
}

export class LimitedFundDetailsSyncService extends FundDetailsSyncService {
  constructor(repository, jobLimit, options = {}) {
    super(repository, options)
    this.jobLimit = jobLimit
  }

  async processJobs(jobs) {
    return super.processJobs(jobs.slice(0, this.jobLimit))
  }
}

export function expectValidFundPayload(payload) {
  expect(payload).toBeTypeOf('object')
  expect(payload.fondoId).toBeTypeOf('string')
  expect(payload.fondoId.length).toBeGreaterThan(0)
  expect(payload.claseId).toBeTypeOf('string')
  expect(payload.claseId.length).toBeGreaterThan(0)
  expect(payload.slug).toBeTypeOf('string')
  expect(payload.nombre).toBeTypeOf('string')
  expect(payload.rendimientos).toBeTypeOf('object')

  if (payload.fecha) {
    expect(payload.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  }

  if (payload.rendimientos.valorCuotaparte != null) {
    expect(payload.rendimientos.valorCuotaparte).toBeTypeOf('number')
  }
}

export function getCompletedJob(repository, jobId) {
  return repository.db
    .prepare('SELECT * FROM fund_detail_jobs WHERE id = ?')
    .get(jobId)
}
