import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { FundDetailsSyncService } from '../../../apps/cafci-worker/src/services/fundDetailsSyncService.js'
import {
  LimitedFundDetailsSyncService,
  createPendingJobs,
  createTempRepository,
  expectValidFundPayload,
  fetchSampleFunds,
  getCompletedJob,
  todayExecutionDate,
} from '../helpers/fundDetailsSyncService.js'

// Integración contra CAFCI (sin mocks). Para inspeccionar payloads,
// agregá console.log en fundDetailsSyncService.js o cafciClient.js y corré:
// pnpm cafci-worker:test

const cleanups = []
let sampleFunds = []

beforeAll(async () => {
  sampleFunds = await fetchSampleFunds(2)
  expect(sampleFunds.length).toBeGreaterThan(0)
}, 120_000)

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

describe('FundDetailsSyncService.processJob', () => {
  it(
    'descarga y persiste el detalle de un fondo CAFCI',
    async () => {
      const temp = await createTempRepository()
      cleanups.push(temp.cleanup)

      const executionDate = todayExecutionDate()
      const [fund] = sampleFunds
      const [job] = createPendingJobs(temp.repository, executionDate, [fund])
      const service = new FundDetailsSyncService(temp.repository, {
        concurrency: 1,
      })

      await service.processJob(job)

      const completedJob = getCompletedJob(temp.repository, job.id)
      const payload = JSON.parse(completedJob.payload)

      expect(completedJob.status).toBe('completed')
      expect(completedJob.fund_id).toBe(fund.fondoId)
      expect(completedJob.class_id).toBe(fund.claseId)
      expectValidFundPayload(payload)

      const currentFunds = temp.repository.getCurrentFunds()
      expect(currentFunds.some(entry => entry.slug === payload.slug)).toBe(true)

      if (payload.fecha) {
        expect(temp.repository.countHistoricalSnapshots()).toBeGreaterThan(0)
      }
    },
    120_000,
  )
})

describe('FundDetailsSyncService.processJobs', () => {
  it(
    'procesa un lote de jobs pendientes',
    async () => {
      const temp = await createTempRepository()
      cleanups.push(temp.cleanup)

      const executionDate = todayExecutionDate()
      const jobs = createPendingJobs(temp.repository, executionDate, sampleFunds)
      const service = new FundDetailsSyncService(temp.repository, {
        concurrency: 1,
      })

      await service.processJobs(jobs)

      for (const job of jobs) {
        const completedJob = getCompletedJob(temp.repository, job.id)
        const payload = JSON.parse(completedJob.payload)

        expect(completedJob.status).toBe('completed')
        expectValidFundPayload(payload)
      }

      expect(temp.repository.getCurrentFunds().length).toBe(sampleFunds.length)
    },
    180_000,
  )
})

describe('FundDetailsSyncService.runCycle', () => {
  it(
    'crea jobs desde el catálogo y procesa un subconjunto acotado',
    async () => {
      const temp = await createTempRepository()
      cleanups.push(temp.cleanup)

      const service = new LimitedFundDetailsSyncService(temp.repository, 2, {
        concurrency: 1,
      })

      const summary = await service.runCycle()

      expect(summary.executionDate).toBe(todayExecutionDate())
      expect(summary.createdJobs).toBeGreaterThan(1000)
      expect(summary.processedJobs).toBeGreaterThan(1000)
      expect(summary.stats.completed).toBe(2)
      expect(summary.currentFunds).toBe(2)

      const currentFunds = temp.repository.getCurrentFunds()
      expect(currentFunds).toHaveLength(2)
      for (const fund of currentFunds) {
        expectValidFundPayload(fund)
      }
    },
    300_000,
  )

  it(
    'reintenta jobs fallidos cuando forceRetryFailed es true',
    async () => {
      const temp = await createTempRepository()
      cleanups.push(temp.cleanup)

      const executionDate = todayExecutionDate()
      const [fund] = sampleFunds
      const [job] = createPendingJobs(temp.repository, executionDate, [fund])

      temp.repository.markFailed(job.id, 20, 'fallo de prueba', 20)
      expect(getCompletedJob(temp.repository, job.id).status).toBe('failed')

      const service = new LimitedFundDetailsSyncService(temp.repository, 1, {
        concurrency: 1,
      })

      const summary = await service.runCycle({ forceRetryFailed: true })

      expect(summary.stats.completed).toBeGreaterThanOrEqual(1)

      const completedJob = getCompletedJob(temp.repository, job.id)
      expect(completedJob.status).toBe('completed')
      expectValidFundPayload(JSON.parse(completedJob.payload))
    },
    300_000,
  )
})

describe('FundDetailsSyncService.shouldUploadBackup', () => {
  it('devuelve true si nunca se subió un backup', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository, {
      r2UploadIntervalMs: 60_000,
    })

    expect(service.shouldUploadBackup()).toBe(true)
  })

  it('devuelve false si el último backup es reciente', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository, {
      r2UploadIntervalMs: 60_000,
    })

    temp.repository.setWorkerState(
      'last_r2_backup_at',
      new Date().toISOString(),
    )

    expect(service.shouldUploadBackup()).toBe(false)
  })

  it('devuelve true si el último backup ya expiró', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository, {
      r2UploadIntervalMs: 60_000,
    })

    temp.repository.setWorkerState(
      'last_r2_backup_at',
      new Date(Date.now() - 120_000).toISOString(),
    )

    expect(service.shouldUploadBackup(Date.now())).toBe(true)
  })
})

describe('FundDetailsSyncService.maybeUploadBackup', () => {
  it(
    'omite la subida cuando todavía no corresponde',
    async () => {
      const temp = await createTempRepository()
      cleanups.push(temp.cleanup)

      const service = new FundDetailsSyncService(temp.repository, {
        r2UploadIntervalMs: 60_000,
      })

      temp.repository.setWorkerState(
        'last_r2_backup_at',
        new Date().toISOString(),
      )

      await expect(service.maybeUploadBackup()).resolves.toBe(false)
      expect(temp.repository.getWorkerState('last_r2_backup_at')).toBeTruthy()
    },
    30_000,
  )

  it(
    'no actualiza worker_state si R2 no está configurado',
    async () => {
      const temp = await createTempRepository()
      cleanups.push(temp.cleanup)

      const service = new FundDetailsSyncService(temp.repository, {
        r2UploadIntervalMs: 0,
      })

      await expect(service.maybeUploadBackup()).resolves.toBe(false)
      expect(temp.repository.getWorkerState('last_r2_backup_at')).toBeNull()
    },
    30_000,
  )
})
