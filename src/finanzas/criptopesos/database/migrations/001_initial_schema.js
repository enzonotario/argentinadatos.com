export const migration_001_initial_schema = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    console.log(
      'Iniciando migración 001: creando esquema inicial de criptopesos...',
    )

    await db.execute(`
      CREATE TABLE IF NOT EXISTS criptopesos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL,
        entidad TEXT NOT NULL,
        tna REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_criptopesos_token ON criptopesos(token)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_criptopesos_entidad ON criptopesos(entidad)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_criptopesos_timestamp ON criptopesos(timestamp)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_criptopesos_token_entidad ON criptopesos(token, entidad)
    `)

    console.log('Migración 001 completada: esquema inicial creado exitosamente')
  },

  async down(db) {
    console.log('Revirtiendo migración 001: eliminando tabla criptopesos...')

    await db.execute('DROP INDEX IF EXISTS idx_criptopesos_token_entidad')
    await db.execute('DROP INDEX IF EXISTS idx_criptopesos_timestamp')
    await db.execute('DROP INDEX IF EXISTS idx_criptopesos_entidad')
    await db.execute('DROP INDEX IF EXISTS idx_criptopesos_token')
    await db.execute('DROP TABLE IF EXISTS criptopesos')

    console.log('Migración 001 revertida: tabla eliminada')
  },
}
