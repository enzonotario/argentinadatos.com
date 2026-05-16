export const migration_002_nullable_fechaEmision_tem = {
  version: 2,
  name: 'nullable_fechaEmision_tem',

  async up(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS letras_new (
        ticker TEXT PRIMARY KEY,
        fechaEmision TEXT,
        fechaVencimiento TEXT NOT NULL,
        tem REAL,
        vpv REAL NOT NULL,
        fechaActualizacion TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await db.execute(`
      INSERT INTO letras_new (ticker, fechaEmision, fechaVencimiento, tem, vpv, fechaActualizacion)
      SELECT ticker, fechaEmision, fechaVencimiento, tem, vpv, fechaActualizacion FROM letras
    `)

    await db.execute(`DROP TABLE letras`)
    await db.execute(`ALTER TABLE letras_new RENAME TO letras`)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_letras_fechaVencimiento ON letras(fechaVencimiento)
    `)
  },

  async down(db) {
    await db.execute('DROP INDEX IF EXISTS idx_letras_fechaVencimiento')
    await db.execute('DROP TABLE IF EXISTS letras')
  },
}
