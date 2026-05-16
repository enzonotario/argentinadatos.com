import { createClient } from '@libsql/client'
import { MigrationRunner } from './migrations/migration-runner.js'

export class CriptopesosDatabaseService {
  constructor(url, authToken) {
    this.db = createClient({
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunner(this.db)
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async insertCriptopeso(token, entidad, tna, timestamp) {
    await this.db.execute({
      sql: `
        INSERT INTO criptopesos (token, entidad, tna, timestamp)
        VALUES (?, ?, ?, ?)
      `,
      args: [token, entidad, tna, timestamp],
    })
  }

  async getLatestCriptopesoByEntity(token, entidad) {
    const resultado = await this.db.execute({
      sql: `
        SELECT id, token, entidad, tna, timestamp
        FROM criptopesos
        WHERE token = ? AND entidad = ?
        ORDER BY timestamp DESC, created_at DESC
        LIMIT 1
      `,
      args: [token, entidad],
    })

    if (resultado.rows.length === 0) {
      return null
    }

    const row = resultado.rows[0]

    return {
      id: row.id,
      token: row.token,
      entidad: row.entidad,
      tna: row.tna,
      timestamp: row.timestamp,
    }
  }

  async getAllLatestCriptopesos() {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM criptopesos c
        INNER JOIN (
          SELECT token, entidad, MAX(timestamp) AS max_timestamp
          FROM criptopesos
          GROUP BY token, entidad
        ) latest ON c.token = latest.token 
          AND c.entidad = latest.entidad 
          AND c.timestamp = latest.max_timestamp
        ORDER BY c.entidad, c.token
      `,
    })

    return resultado.rows.map(row => ({
      id: row.id,
      token: row.token,
      entidad: row.entidad,
      tna: row.tna,
      timestamp: row.timestamp,
    }))
  }

  close() {
    this.db.close()
  }
}
