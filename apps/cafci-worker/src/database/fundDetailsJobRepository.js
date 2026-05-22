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

  getWorkerState(key) {
    const row = this.db
      .prepare(
        `
          SELECT value
          FROM worker_state
          WHERE key = ?
          LIMIT 1
        `,
      )
      .get(key)

    return row?.value ?? null
  }

  setWorkerState(key, value) {
    this.db
      .prepare(
        `
          INSERT INTO worker_state (key, value, created_at, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(key)
          DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        `,
      )
      .run(key, value)
  }

  deleteWorkerState(key) {
    this.db.prepare('DELETE FROM worker_state WHERE key = ?').run(key)
  }

  countHistoricalSnapshots() {
    return this.db
      .prepare('SELECT COUNT(*) AS count FROM historical_fund_snapshots')
      .get().count
  }

  isHistoricalBackfillCompleted() {
    return Boolean(this.getWorkerState('historical_backfill_completed_at'))
  }

  markHistoricalBackfillCompleted(completedAt = new Date().toISOString()) {
    this.setWorkerState('historical_backfill_completed_at', completedAt)
  }

  upsertHistoricalSnapshot(snapshot) {
    this.db
      .prepare(
        `
          INSERT INTO historical_fund_snapshots (
            slug,
            fund_id,
            class_id,
            name,
            source_date,
            category_key,
            category_label,
            horizon,
            share_value,
            assets_under_management,
            daily_return,
            cumulative_return,
            estimated_net_flow,
            source_kind,
            raw_source,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(slug, source_date)
          DO UPDATE SET
            fund_id = excluded.fund_id,
            class_id = excluded.class_id,
            name = excluded.name,
            category_key = excluded.category_key,
            category_label = excluded.category_label,
            horizon = excluded.horizon,
            share_value = excluded.share_value,
            assets_under_management = excluded.assets_under_management,
            daily_return = excluded.daily_return,
            cumulative_return = excluded.cumulative_return,
            estimated_net_flow = excluded.estimated_net_flow,
            source_kind = excluded.source_kind,
            raw_source = excluded.raw_source,
            updated_at = CURRENT_TIMESTAMP
        `,
      )
      .run(
        snapshot.slug,
        snapshot.fundId,
        snapshot.classId,
        snapshot.name,
        snapshot.sourceDate,
        snapshot.categoryKey,
        snapshot.categoryLabel,
        snapshot.horizon,
        snapshot.shareValue,
        snapshot.assetsUnderManagement,
        snapshot.dailyReturn,
        snapshot.cumulativeReturn,
        snapshot.estimatedNetFlow,
        snapshot.sourceKind,
        snapshot.rawSource ? JSON.stringify(snapshot.rawSource) : null,
      )
  }

  listHistoricalSnapshotsBySlug(slug) {
    return this.db
      .prepare(
        `
          SELECT *
          FROM historical_fund_snapshots
          WHERE slug = ?
          ORDER BY source_date
        `,
      )
      .all(slug)
      .map(row => this.mapHistoricalSnapshot(row))
  }

  getFirstHistoricalSnapshot(slug) {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM historical_fund_snapshots
          WHERE slug = ?
          ORDER BY source_date ASC
          LIMIT 1
        `,
      )
      .get(slug)

    return row ? this.mapHistoricalSnapshot(row) : null
  }

  getLatestHistoricalSnapshotBefore(slug, sourceDate) {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM historical_fund_snapshots
          WHERE slug = ?
            AND source_date < ?
          ORDER BY source_date DESC
          LIMIT 1
        `,
      )
      .get(slug, sourceDate)

    return row ? this.mapHistoricalSnapshot(row) : null
  }

  mapHistoricalSnapshot(row) {
    return {
      id: row.id,
      slug: row.slug,
      fundId: row.fund_id,
      classId: row.class_id,
      name: row.name,
      sourceDate: row.source_date,
      categoryKey: row.category_key,
      categoryLabel: row.category_label,
      horizon: row.horizon,
      shareValue: row.share_value,
      assetsUnderManagement: row.assets_under_management,
      dailyReturn: row.daily_return,
      cumulativeReturn: row.cumulative_return,
      estimatedNetFlow: row.estimated_net_flow,
      sourceKind: row.source_kind,
      rawSource: row.raw_source ? JSON.parse(row.raw_source) : null,
    }
  }

  exportDatabaseSnapshot(destinationPath) {
    mkdirSync(dirname(destinationPath), {
      recursive: true,
    })
    this.db.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(this.databasePath, destinationPath)
  }

  importHistoricalBackfillFromDatabase(sourceDatabasePath) {
    const attachedSchema = 'seed_backfill'
    const beforeCount = this.countHistoricalSnapshots()

    this.db.prepare(`ATTACH DATABASE ? AS ${attachedSchema}`).run(sourceDatabasePath)

    try {
      const hasHistoricalTable = this.db
        .prepare(
          `
            SELECT name
            FROM ${attachedSchema}.sqlite_master
            WHERE type = 'table'
              AND name = 'historical_fund_snapshots'
            LIMIT 1
          `,
        )
        .get()

      if (!hasHistoricalTable) {
        return 0
      }

      this.db
        .prepare(
          `
            INSERT OR REPLACE INTO historical_fund_snapshots (
              slug,
              fund_id,
              class_id,
              name,
              source_date,
              category_key,
              category_label,
              horizon,
              share_value,
              assets_under_management,
              daily_return,
              cumulative_return,
              estimated_net_flow,
              source_kind,
              raw_source,
              created_at,
              updated_at
            )
            SELECT
              slug,
              fund_id,
              class_id,
              name,
              source_date,
              category_key,
              category_label,
              horizon,
              share_value,
              assets_under_management,
              daily_return,
              cumulative_return,
              estimated_net_flow,
              source_kind,
              raw_source,
              created_at,
              updated_at
            FROM ${attachedSchema}.historical_fund_snapshots
          `,
        )
        .run()
    } finally {
      this.db.exec(`DETACH DATABASE ${attachedSchema}`)
    }

    const afterCount = this.countHistoricalSnapshots()

    if (afterCount > 0) {
      this.markHistoricalBackfillCompleted()
    }

    return afterCount - beforeCount
  }

  close() {
    this.db.close()
  }
}
