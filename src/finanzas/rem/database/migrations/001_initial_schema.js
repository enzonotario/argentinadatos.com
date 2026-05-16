export const migration_001_initial_schema = {
  version: 1,
  name: 'initial_schema',

  async up(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS rem_expectativas (
        informe TEXT NOT NULL,
        fecha TEXT,
        muestra TEXT NOT NULL,
        indicador TEXT NOT NULL,
        periodo TEXT NOT NULL,
        periodoTipo TEXT,
        periodoDesde TEXT,
        periodoHasta TEXT,
        referencia TEXT NOT NULL,
        referenciaFecha TEXT,
        unidad TEXT,
        mediana REAL,
        promedio REAL,
        desvio REAL,
        maximo REAL,
        minimo REAL,
        percentil90 REAL,
        percentil75 REAL,
        percentil25 REAL,
        percentil10 REAL,
        participantes INTEGER,
        fuente TEXT,
        publicacionUrl TEXT,
        xlsxUrl TEXT,
        fechaActualizacion TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (informe, muestra, indicador, periodo, referencia)
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_rem_expectativas_informe
      ON rem_expectativas(informe)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_rem_expectativas_indicador
      ON rem_expectativas(indicador)
    `)
  },

  async down(db) {
    await db.execute('DROP INDEX IF EXISTS idx_rem_expectativas_indicador')
    await db.execute('DROP INDEX IF EXISTS idx_rem_expectativas_informe')
    await db.execute('DROP TABLE IF EXISTS rem_expectativas')
  },
}
