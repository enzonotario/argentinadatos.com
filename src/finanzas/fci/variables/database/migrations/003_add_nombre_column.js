export const migration_003_add_nombre_column = {
  version: 3,
  name: 'add_nombre_column',

  async up(db) {
    console.log(
      'Iniciando migración 003: agregando columna nombre y renombrando semántica de fondo...',
    )

    try {
      await db.execute(`
        ALTER TABLE fci_variables ADD COLUMN nombre TEXT
      `)
    } catch (error) {
      if (String(error).includes('duplicate column name: nombre')) {
        console.log(
          'La columna nombre ya existe en fci_variables, se omite el ALTER',
        )
      } else {
        throw error
      }
    }

    await db.execute(`
      UPDATE fci_variables SET nombre = fondo WHERE nombre IS NULL AND fondo IS NOT NULL
    `)

    await db.execute(`
      UPDATE fci_variables
      SET fondo = 'Compass Liquidez - Clase A'
      WHERE nombre = 'GLOBAL66'
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_variables_nombre ON fci_variables(nombre)
    `)

    console.log('Migración 003 completada')
  },

  async down() {
    console.log('Migración 003: rollback no implementado para SQLite')
  },
}
