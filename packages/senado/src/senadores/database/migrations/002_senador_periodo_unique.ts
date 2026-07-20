export const migration_002_senador_periodo_unique = {
  version: 2,
  name: 'senador_periodo_unique',

  async up(db: any) {
    // El listado histórico del Senado reutiliza el mismo ID para varios
    // mandatos. UNIQUE(senadorId) pisaba el periodo vigente con uno viejo.
    await db.execute('DROP INDEX IF EXISTS idx_senadores_senadorId_unique')

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_senadores_senadorId_periodo_unique
      ON senadores(senadorId, periodoLegalInicio)
    `)
  },

  async down(db: any) {
    await db.execute('DROP INDEX IF EXISTS idx_senadores_senadorId_periodo_unique')

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_senadores_senadorId_unique
      ON senadores(senadorId)
    `)
  },
}
