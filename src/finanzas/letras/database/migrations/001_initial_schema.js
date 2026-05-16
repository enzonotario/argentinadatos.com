export const migration_001_initial_schema = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS letras (
        ticker TEXT PRIMARY KEY,
        fechaEmision TEXT NOT NULL,
        fechaVencimiento TEXT NOT NULL,
        tem REAL NOT NULL,
        vpv REAL NOT NULL,
        fechaActualizacion TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_letras_fechaVencimiento ON letras(fechaVencimiento)
    `)
  },

  async down(db) {
    await db.execute('DROP INDEX IF EXISTS idx_letras_fechaVencimiento')
    await db.execute('DROP TABLE IF EXISTS letras')
  },
}
