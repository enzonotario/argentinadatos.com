import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getDatabasePath } from '../config.js'
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

  upsertCurrentFundDetail(payload, fetchedAt = new Date().toISOString()) {
    this.db
      .prepare(
        `
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
        `,
      )
      .run(
        payload.fondoId,
        payload.claseId,
        payload.slug,
        payload.nombre,
        JSON.stringify(payload),
        payload.fecha ?? null,
        fetchedAt,
      )
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

  getCurrentFundByClassId(classId) {
    const row = this.db
      .prepare(
        `
          SELECT fund_id, class_id, slug, name, payload
          FROM current_fund_details
          WHERE class_id = ?
          LIMIT 1
        `,
      )
      .get(String(classId))

    if (!row) {
      return null
    }

    return {
      fondoId: row.fund_id,
      claseId: row.class_id,
      slug: row.slug,
      nombre: row.name,
      payload: JSON.parse(row.payload),
    }
  }

  buildClassIdToFondoIdMap() {
    const map = new Map()

    const historicalRows = this.db
      .prepare(
        `
          SELECT class_id, fund_id
          FROM historical_fund_snapshots
          WHERE class_id IS NOT NULL
            AND fund_id IS NOT NULL
          ORDER BY source_date ASC
        `,
      )
      .all()

    for (const row of historicalRows) {
      map.set(String(row.class_id), String(row.fund_id))
    }

    const currentRows = this.db
      .prepare(
        `
          SELECT class_id, fund_id
          FROM current_fund_details
        `,
      )
      .all()

    for (const row of currentRows) {
      map.set(String(row.class_id), String(row.fund_id))
    }

    return map
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
        snapshot.fondoId,
        snapshot.claseId,
        snapshot.nombre,
        snapshot.fecha,
        snapshot.categoriaKey,
        snapshot.categoria,
        snapshot.horizonte,
        snapshot.valorCuotaparte,
        snapshot.patrimonio,
        snapshot.retornoDiario,
        snapshot.retornoAcumulado,
        snapshot.flujoEstimado,
        snapshot.origen,
        snapshot.fuenteOriginal
          ? JSON.stringify(snapshot.fuenteOriginal)
          : null,
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
      fondoId: row.fund_id,
      claseId: row.class_id,
      nombre: row.name,
      fecha: row.source_date,
      categoriaKey: row.category_key,
      categoria: row.category_label,
      horizonte: row.horizon,
      valorCuotaparte: row.share_value,
      patrimonio: row.assets_under_management,
      retornoDiario: row.daily_return,
      retornoAcumulado: row.cumulative_return,
      flujoEstimado: row.estimated_net_flow,
      origen: row.source_kind,
      fuenteOriginal: row.raw_source ? JSON.parse(row.raw_source) : null,
    }
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
