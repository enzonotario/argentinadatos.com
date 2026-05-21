import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getDatabasePath, getMaxAttempts } from '../config.js'
import { migrations } from './migrations/index.js'
import { MigrationRunner } from './migrations/migrationRunner.js'

export class FundDetailsJobRepository {
  constructor(databasePath = getDatabasePath()) {
    const directory = dirname(databasePath)

    if (!existsSync(directory)) {
      mkdirSync(directory, {
        recursive: true,
      })
    }

    this.databasePath = databasePath
    this.db = new Database(databasePath)
    this.db.pragma('journal_mode = WAL')
    this.migrationRunner = new MigrationRunner(
      this.db,
      'cafci-worker',
      migrations,
    )
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  createJobsForDate(executionDate, funds) {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO fund_detail_jobs (
        fund_id,
        class_id,
        slug,
        name,
        execution_date,
        status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `)

    const insertMany = this.db.transaction(items => {
      for (const fund of items) {
        insert.run(
          fund.fundId,
          fund.classId,
          fund.slug,
          fund.name,
          executionDate,
        )
      }
    })

    insertMany(funds)
  }

  getJobsByExecutionDate(executionDate) {
    return this.db
      .prepare(
        'SELECT * FROM fund_detail_jobs WHERE execution_date = ? ORDER BY id',
      )
      .all(executionDate)
  }

  getPendingJobs(executionDate) {
    const now = new Date().toISOString()

    return this.db
      .prepare(
        `
          SELECT *
          FROM fund_detail_jobs
          WHERE execution_date = ?
            AND status = 'pending'
            AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
          ORDER BY id
        `,
      )
      .all(executionDate, now)
  }

  countJobsByStatus(executionDate) {
    const rows = this.db
      .prepare(
        `
          SELECT status, COUNT(*) AS count
          FROM fund_detail_jobs
          WHERE execution_date = ?
          GROUP BY status
        `,
      )
      .all(executionDate)

    return rows.reduce((stats, row) => {
      stats[row.status] = row.count
      return stats
    }, {})
  }

  resetFailedJobs(executionDate) {
    const result = this.db
      .prepare(
        `
          UPDATE fund_detail_jobs
          SET status = 'pending',
              attempts = 0,
              next_attempt_at = NULL,
              error = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE execution_date = ?
            AND status = 'failed'
        `,
      )
      .run(executionDate)

    return result.changes
  }

  markCompleted(jobId, payload) {
    const updateJob = this.db.prepare(`
      UPDATE fund_detail_jobs
      SET status = 'completed',
          payload = ?,
          fetched_at = ?,
          error = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    const upsertCurrent = this.db.prepare(`
      INSERT INTO current_fund_details (
        fund_id,
        class_id,
        slug,
        name,
        payload,
        source_date,
        fetched_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(fund_id, class_id)
      DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        payload = excluded.payload,
        source_date = excluded.source_date,
        fetched_at = excluded.fetched_at,
        updated_at = CURRENT_TIMESTAMP
    `)

    const now = new Date().toISOString()
    const transaction = this.db.transaction(() => {
      updateJob.run(JSON.stringify(payload), now, jobId)
      upsertCurrent.run(
        payload.fundId,
        payload.classId,
        payload.slug,
        payload.name,
        JSON.stringify(payload),
        payload.date ?? null,
        now,
      )
    })

    transaction()
  }

  markFailed(jobId, attempts, error, maxAttempts = getMaxAttempts()) {
    const delayMs = Math.min(Math.pow(2, attempts) * 1000, 60_000)
    const nextAttemptAt = new Date(Date.now() + delayMs).toISOString()
    const status = attempts >= maxAttempts ? 'failed' : 'pending'

    this.db
      .prepare(
        `
          UPDATE fund_detail_jobs
          SET status = ?,
              attempts = ?,
              next_attempt_at = ?,
              error = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      )
      .run(status, attempts, nextAttemptAt, error, jobId)
  }

  getCurrentFunds() {
    return this.db
      .prepare(
        `
          SELECT payload
          FROM current_fund_details
          ORDER BY lower(name), lower(slug)
        `,
      )
      .all()
      .map(row => JSON.parse(row.payload))
  }

  exportDatabaseSnapshot(destinationPath) {
    mkdirSync(dirname(destinationPath), {
      recursive: true,
    })
    this.db.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(this.databasePath, destinationPath)
  }

  close() {
    this.db.close()
  }
}
