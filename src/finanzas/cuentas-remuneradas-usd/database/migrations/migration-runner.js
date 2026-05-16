import { migration_001_initial_schema } from './001_initial_schema.js'

const MIGRATIONS = [migration_001_initial_schema]

export class MigrationRunner {
  constructor(db, scope = 'cuentas-remuneradas-usd') {
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

  async rollbackLastMigration() {
    console.log('Revirtiendo última migración...')

    await this.initializeMigrationsTable()
    const executedMigrations = await this.getExecutedMigrations()

    if (executedMigrations.size === 0) {
      console.log('No hay migraciones para revertir')
      return
    }

    const lastMigrationVersion = Math.max(...Array.from(executedMigrations))
    const migration = MIGRATIONS.find(m => m.version === lastMigrationVersion)

    if (!migration) {
      throw new Error(
        `No se encontró la migración versión ${lastMigrationVersion}`,
      )
    }

    try {
      console.log(
        `Revirtiendo migración ${migration.version}: ${migration.name}`,
      )
      await migration.down(this.db)

      await this.db.execute({
        sql: 'DELETE FROM migrations WHERE scope = ? AND version = ?',
        args: [this.scope, migration.version],
      })
      console.log(`Migración ${migration.version} revertida exitosamente`)
    } catch (error) {
      console.error(`Error revirtiendo migración ${migration.version}:`, error)
      throw new Error(
        `Falló la reversión de la migración ${migration.version}: ${error}`,
      )
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
