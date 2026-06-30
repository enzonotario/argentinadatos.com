export const migration_002_add_plazo_columns = {
  version: 2,
  name: 'add_plazo_columns',

  async up(db) {
    console.log(
      'Iniciando migración 002: agregando columnas de plazo en fci_otros...',
    )

    for (const columna of ['plazoMinDias', 'plazoMaxDias']) {
      try {
        await db.execute(`
          ALTER TABLE fci_otros ADD COLUMN ${columna} INTEGER
        `)
      } catch (error) {
        if (String(error).includes(`duplicate column name: ${columna}`)) {
          console.log(`La columna ${columna} ya existe en fci_otros, se omite`)
          continue
        }

        throw error
      }
    }

    console.log('Migración 002 completada: columnas de plazo agregadas')
  },

  async down() {
    console.log('Migración 002: rollback no implementado para SQLite')
  },
}
