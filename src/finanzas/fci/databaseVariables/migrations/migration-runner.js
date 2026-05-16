import { migration_001_initial_schema } from './001_initial_schema.js'
import { migration_002_add_tipo_column } from './002_add_tipo_column.js'
import { migration_003_add_nombre_column } from './003_add_nombre_column.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

const MIGRATIONS = [
  migration_001_initial_schema,
  migration_002_add_tipo_column,
  migration_003_add_nombre_column,
]

export class MigrationRunnerVariables {
  constructor(db, scope = 'fci-variables') {
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
    const resultado = await this.db.execute({
      sql: 'SELECT version FROM migrations WHERE scope = ?',
      args: [this.scope],
    })

    return new Set(resultado.rows.map(row => Number(row.version)))
  }

  async markMigrationAsExecuted(migration) {
    await this.db.execute({
      sql: 'INSERT OR IGNORE INTO migrations (scope, version, name) VALUES (?, ?, ?)',
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
        const log = logGrupo({
          comando: 'fci.variables.migrations',
          scope: this.scope,
          migrationVersion: migration.version,
          migrationName: migration.name,
        })

        logError(log, error)
        logMensaje(log, 'Error ejecutando migración', {
          migrationVersion: migration.version,
          migrationName: migration.name,
        })
        throw new Error(`Falló la migración ${migration.version}: ${error}`)
      }
    }

    console.log('Todas las migraciones se ejecutaron exitosamente')
  }
}
