import { migration_001_initial_schema } from './001_initial_schema.js'
import { migration_002_nullable_fechaEmision_tem } from './002_nullable_fechaEmision_tem.js'

const MIGRATIONS = [
  migration_001_initial_schema,
  migration_002_nullable_fechaEmision_tem,
]

export class MigrationRunner {
  constructor(db, scope = 'letras') {
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
    console.log('Iniciando sistema de migraciones...')

    await this.initializeMigrationsTable()
    const executedMigrations = await this.getExecutedMigrations()

    const pendingMigrations = MIGRATIONS.filter(
      migration => !executedMigrations.has(migration.version),
    )

    if (pendingMigrations.length === 0) {
      console.log('No hay migraciones pendientes')
      return
    }

    console.log(
      `Encontradas ${pendingMigrations.length} migraciones pendientes`,
    )

    for (const migration of pendingMigrations) {
      try {
        console.log(
          `Ejecutando migración ${migration.version}: ${migration.name}`,
        )
        await migration.up(this.db)
        await this.markMigrationAsExecuted(migration)
        console.log(`Migración ${migration.version} ejecutada exitosamente`)
      } catch (error) {
        console.error(`Error ejecutando migración ${migration.version}:`, error)
        throw new Error(`Falló la migración ${migration.version}: ${error}`)
      }
    }

    console.log('Todas las migraciones se ejecutaron exitosamente')
  }
}
