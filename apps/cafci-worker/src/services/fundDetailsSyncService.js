import {
  getConcurrency,
  getMaxAttempts,
  getPollIntervalMs,
  getR2UploadIntervalMs,
} from '../config.js'
import { fetchFundDetail, fetchFundsCatalog } from '../cafci/cafciClient.js'
import { recordHistoricalSnapshotFromDetail } from '../history/recordHistoricalSnapshotFromDetail.js'
import { uploadDatabaseBackupToR2 } from '../r2/uploadDatabaseBackupToR2.js'
import { sleep } from '../utils/sleep.js'

export class FundDetailsSyncService {
  constructor(repository, options = {}) {
    this.repository = repository
    this.concurrency = options.concurrency ?? getConcurrency()
    this.maxAttempts = options.maxAttempts ?? getMaxAttempts()
    this.pollIntervalMs = options.pollIntervalMs ?? getPollIntervalMs()
    this.r2UploadIntervalMs =
      options.r2UploadIntervalMs ?? getR2UploadIntervalMs()
  }

  async runCycle({ forceRetryFailed = false } = {}) {
    const executionDate = new Date().toISOString().slice(0, 10)
    const catalog = await fetchFundsCatalog()

    if (catalog.length === 0) {
      return {
        executionDate,
        createdJobs: 0,
        processedJobs: 0,
        stats: {},
      }
    }

    this.repository.createJobsForDate(executionDate, catalog)

    if (forceRetryFailed) {
      this.repository.resetFailedJobs(executionDate)
    }

    const pendingJobs = this.repository.getPendingJobs(executionDate)

    if (pendingJobs.length > 0) {
      await this.processJobs(pendingJobs)
    }

    return {
      executionDate,
      createdJobs: catalog.length,
      processedJobs: pendingJobs.length,
      stats: this.repository.countJobsByStatus(executionDate),
      currentFunds: this.repository.getCurrentFunds().length,
    }
  }

  async processJobs(jobs) {
    for (let index = 0; index < jobs.length; index += this.concurrency) {
      const batch = jobs.slice(index, index + this.concurrency)
      await Promise.all(batch.map(job => this.processJob(job)))
    }
  }

  async processJob(job) {
    const attempts = Number(job.attempts || 0) + 1

    try {
      const payload = await fetchFundDetail(job.fund_id, job.class_id)

      if (!payload) {
        this.repository.markFailed(
          job.id,
          attempts,
          'Fund detail not available',
        )
        return
      }

      this.repository.markCompleted(job.id, payload)
      await recordHistoricalSnapshotFromDetail(this.repository, payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.repository.markFailed(job.id, attempts, message, this.maxAttempts)
    }
  }

  shouldUploadBackup(now = Date.now()) {
    const lastUploadAt = this.repository.getWorkerState('last_r2_backup_at')

    if (!lastUploadAt) {
      return true
    }

    const lastUploadTime = new Date(lastUploadAt).getTime()

    if (!Number.isFinite(lastUploadTime)) {
      return true
    }

    return now - lastUploadTime >= this.r2UploadIntervalMs
  }

  async maybeUploadBackup() {
    if (!this.shouldUploadBackup()) {
      console.log('[cafci-worker] skipping R2 upload for this cycle', {
        nextEligibleInMs: this.r2UploadIntervalMs,
      })
      return false
    }

    const uploaded = await uploadDatabaseBackupToR2(this.repository)

    if (uploaded) {
      this.repository.setWorkerState(
        'last_r2_backup_at',
        new Date().toISOString(),
      )
    }

    return uploaded
  }

  async startPolling({ forceRetryFailed = false } = {}) {
    while (true) {
      try {
        const summary = await this.runCycle({ forceRetryFailed })
        await this.maybeUploadBackup()
        console.log('[cafci-worker] cycle summary', summary)
      } catch (error) {
        console.error('[cafci-worker] cycle failed', error)
      }

      await sleep(this.pollIntervalMs)
    }
  }
}
