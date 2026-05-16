import { migration_001_initial_schema } from './001_initial_schema.js'

const MIGRATIONS = [migration_001_initial_schema]

export class MigrationRunner {
  constructor(db, scope = 'rem') {
    this.db = db
    this.scope = scope
  }

  async initializeMigrationsTable() {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        scope TEXT NOT NULL,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (scope, version)
      )
    `)
  }

  async getExecutedMigrations() {
    const result = await this.db.execute({
      sql: 'SELECT version FROM migrations WHERE scope = ?',
      args: [this.scope],
    })

    return new Set(result.rows.map(row => Number(row.version)))
  }

  async markMigrationAsExecuted(migration) {
    await this.db.execute({
      sql: 'INSERT INTO migrations (scope, version, name) VALUES (?, ?, ?)',
      args: [this.scope, migration.version, migration.name],
    })
  }

  async runPendingMigrations() {
    await this.initializeMigrationsTable()
    const executedMigrations = await this.getExecutedMigrations()
    const pendingMigrations = MIGRATIONS.filter(
      migration => !executedMigrations.has(migration.version),
    )

    for (const migration of pendingMigrations) {
      await migration.up(this.db)
      await this.markMigrationAsExecuted(migration)
    }
  }
}
