export const migration_001_initial_schema = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    console.log(
      'Iniciando migración 001: creando esquema inicial de fci variables...',
    )

    await db.execute(`
      CREATE TABLE IF NOT EXISTS fci_variables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fondo TEXT NOT NULL,
        tna REAL NOT NULL,
        tea REAL NOT NULL,
        tope REAL,
        fecha TEXT NOT NULL,
        condiciones TEXT,
        condicionesCorto TEXT,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_variables_fondo ON fci_variables(fondo)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_variables_timestamp ON fci_variables(timestamp)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_variables_fecha ON fci_variables(fecha)
    `)

    console.log('Migración 001 completada: esquema inicial creado exitosamente')
  },

  async down(db) {
    console.log('Revirtiendo migración 001: eliminando tabla fci_variables...')

    await db.execute('DROP INDEX IF EXISTS idx_fci_variables_fecha')
    await db.execute('DROP INDEX IF EXISTS idx_fci_variables_timestamp')
    await db.execute('DROP INDEX IF EXISTS idx_fci_variables_fondo')
    await db.execute('DROP TABLE IF EXISTS fci_variables')

    console.log('Migración 001 revertida: tabla eliminada')
  },
}
