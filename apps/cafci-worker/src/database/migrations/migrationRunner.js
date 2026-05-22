export class MigrationRunner {
  constructor(database, scope, migrations) {
    this.database = database
    this.scope = scope
    this.migrations = migrations
  }

  async runPendingMigrations() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        scope TEXT NOT NULL,
        migration_id TEXT NOT NULL,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (scope, migration_id)
      )
    `)

    const selectMigration = this.database.prepare(
      'SELECT 1 FROM schema_migrations WHERE scope = ? AND migration_id = ?',
    )
    const insertMigration = this.database.prepare(
      'INSERT INTO schema_migrations (scope, migration_id) VALUES (?, ?)',
    )

    for (const migration of this.migrations) {
      const alreadyExecuted = selectMigration.get(this.scope, migration.id)

      if (alreadyExecuted) {
        continue
      }

      const transaction = this.database.transaction(() => {
        for (const statement of migration.up ?? []) {
          this.database.exec(statement)
        }

        if (typeof migration.run === 'function') {
          migration.run(this.database)
        }

        insertMigration.run(this.scope, migration.id)
      })

      transaction()
    }
  }
}
