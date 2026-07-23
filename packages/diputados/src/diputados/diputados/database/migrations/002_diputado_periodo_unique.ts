export const migration_002_diputado_periodo_unique = {
  version: 2,
  name: 'diputado_periodo_unique',

  async up(db: any) {
    // El dataset histórico de HCDN puede reutilizar el mismo ID en varios
    // mandatos. UNIQUE(diputadoId) pisaba periodos previos al regenerar el endpoint.
    await db.execute('DROP INDEX IF EXISTS idx_diputados_diputadoId_unique')

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_diputados_diputadoId_periodo_unique
      ON diputados(diputadoId, periodoMandatoInicio)
    `)
  },

  async down(db: any) {
    await db.execute('DROP INDEX IF EXISTS idx_diputados_diputadoId_periodo_unique')

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_diputados_diputadoId_unique
      ON diputados(diputadoId)
    `)
  },
}
