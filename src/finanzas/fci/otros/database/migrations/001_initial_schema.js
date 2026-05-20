export const migration_001_initial_schema = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    console.log(
      'Iniciando migración 001: creando esquema inicial de fci otros...',
    )

    await db.execute(`
      CREATE TABLE IF NOT EXISTS fci_otros (
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
      CREATE INDEX IF NOT EXISTS idx_fci_otros_fondo ON fci_otros(fondo)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_otros_timestamp ON fci_otros(timestamp)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_otros_fecha ON fci_otros(fecha)
    `)

    console.log('Migración 001 completada: esquema inicial creado exitosamente')
  },

  async down(db) {
    console.log('Revirtiendo migración 001: eliminando tabla fci_otros...')

    await db.execute('DROP INDEX IF EXISTS idx_fci_otros_fecha')
    await db.execute('DROP INDEX IF EXISTS idx_fci_otros_timestamp')
    await db.execute('DROP INDEX IF EXISTS idx_fci_otros_fondo')
    await db.execute('DROP TABLE IF EXISTS fci_otros')

    console.log('Migración 001 revertida: tabla eliminada')
  },
}
