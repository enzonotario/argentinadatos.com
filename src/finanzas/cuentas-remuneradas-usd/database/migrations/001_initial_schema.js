export const migration_001_initial_schema = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    console.log(
      'Iniciando migración 001: creando esquema inicial de cuentas remuneradas USD...',
    )

    await db.execute(`
      CREATE TABLE IF NOT EXISTS cuentas_remuneradas_usd (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entidad TEXT NOT NULL,
        tasa REAL NOT NULL,
        tope REAL,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_cuentas_remuneradas_usd_entidad ON cuentas_remuneradas_usd(entidad)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_cuentas_remuneradas_usd_timestamp ON cuentas_remuneradas_usd(timestamp)
    `)

    console.log('Migración 001 completada: esquema inicial creado exitosamente')
  },

  async down(db) {
    console.log(
      'Revirtiendo migración 001: eliminando tabla cuentas_remuneradas_usd...',
    )

    await db.execute(
      'DROP INDEX IF EXISTS idx_cuentas_remuneradas_usd_timestamp',
    )
    await db.execute('DROP INDEX IF EXISTS idx_cuentas_remuneradas_usd_entidad')
    await db.execute('DROP TABLE IF EXISTS cuentas_remuneradas_usd')

    console.log('Migración 001 revertida: tabla eliminada')
  },
}
