import { migration_001_initial_schema } from './001_initial_schema.ts'
import { migration_002_diputado_periodo_unique } from './002_diputado_periodo_unique.ts'

const MIGRATIONS = [
  migration_001_initial_schema,
  migration_002_diputado_periodo_unique,
]

export class MigrationRunner {
  private db: any
  private scope: string

  constructor(db: any, scope = 'diputados-diputados') {
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

  async getExecutedMigrations(): Promise<Set<number>> {
    const result = await this.db.execute({
      sql: 'SELECT version FROM migrations WHERE scope = ?',
      args: [this.scope],
    })
    return new Set(result.rows.map((row: any) => Number(row.version)))
  }

  async markMigrationAsExecuted(migration: any) {
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

    if (pendingMigrations.length === 0) {
      return
    }

    for (const migration of pendingMigrations) {
      try {
        await migration.up(this.db)
        await this.markMigrationAsExecuted(migration)
      }
      catch (error) {
        console.error(`Error ejecutando migración ${migration.version}:`, error)
        throw new Error(`Falló la migración ${migration.version}: ${error}`)
      }
    }
  }

  async rollbackLastMigration() {
    await this.initializeMigrationsTable()
    const executedMigrations = await this.getExecutedMigrations()

    if (executedMigrations.size === 0) {
      return
    }

    const lastMigrationVersion = Math.max(...Array.from(executedMigrations))
    const migration = MIGRATIONS.find(m => m.version === lastMigrationVersion)

    if (!migration) {
      throw new Error(`No se encontró la migración versión ${lastMigrationVersion}`)
    }

    try {
      await migration.down(this.db)

      await this.db.execute({
        sql: 'DELETE FROM migrations WHERE scope = ? AND version = ?',
        args: [this.scope, migration.version],
      })
    }
    catch (error) {
      console.error(`Error revirtiendo migración ${migration.version}:`, error)
      throw new Error(`Falló la reversión de la migración ${migration.version}: ${error}`)
    }
  }

  async getMigrationStatus() {
    await this.initializeMigrationsTable()
    const executedMigrations = await this.getExecutedMigrations()
    const allVersions = MIGRATIONS.map(m => m.version)

    return {
      executed: Array.from(executedMigrations).sort(),
      pending: allVersions.filter(v => !executedMigrations.has(v)).sort(),
    }
  }
}


