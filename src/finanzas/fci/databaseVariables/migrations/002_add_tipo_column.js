export const migration_002_add_tipo_column = {
  version: 2,
  name: 'add_tipo_column',

  async up(db) {
    console.log(
      'Iniciando migración 002: agregando columna tipo en fci_variables...',
    )

    try {
      await db.execute(`
        ALTER TABLE fci_variables ADD COLUMN tipo TEXT
      `)
    } catch (error) {
      if (String(error).includes('duplicate column name: tipo')) {
        console.log('La columna tipo ya existe en fci_variables, se omite')
        return
      }

      throw error
    }

    console.log('Migración 002 completada: columna tipo agregada')
  },

  async down() {
    console.log('Migración 002: rollback no implementado para SQLite')
  },
}
