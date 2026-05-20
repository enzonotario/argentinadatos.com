import { MigrationRunner } from './migrations/migration-runner.js'
import { crearClienteLibsql } from '@/utils/libsql.js'

export class LetrasDatabaseService {
  constructor(url, authToken) {
    this.db = crearClienteLibsql({
      scope: 'letras',
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunner(this.db, 'letras')
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async upsertLetra(ticker, fechaEmision, fechaVencimiento, tem, vpv) {
    await this.db.execute({
      sql: `
        INSERT INTO letras (ticker, fechaEmision, fechaVencimiento, tem, vpv, fechaActualizacion)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(ticker) DO UPDATE SET
          fechaEmision = excluded.fechaEmision,
          fechaVencimiento = excluded.fechaVencimiento,
          tem = excluded.tem,
          vpv = excluded.vpv,
          fechaActualizacion = datetime('now')
      `,
      args: [ticker, fechaEmision, fechaVencimiento, tem, vpv],
    })
  }

  async getAllLetras() {
    const result = await this.db.execute(`
      SELECT ticker, fechaEmision, fechaVencimiento, tem, vpv
      FROM letras
      ORDER BY fechaVencimiento ASC
    `)

    return result.rows.map(row => ({
      ticker: row.ticker,
      fechaEmision: row.fechaEmision,
      fechaVencimiento: row.fechaVencimiento,
      tem: row.tem,
      vpv: row.vpv,
    }))
  }

  async deleteLetrasExcept(tickers) {
    if (!tickers || tickers.length === 0) {
      await this.db.execute('DELETE FROM letras')
      return
    }

    const placeholders = tickers.map(() => '?').join(',')

    await this.db.execute({
      sql: `DELETE FROM letras WHERE ticker NOT IN (${placeholders})`,
      args: tickers,
    })
  }

  close() {
    this.db.close()
  }
}
