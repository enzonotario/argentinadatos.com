import { MigrationRunner } from './migrations/migration-runner.js'
import { crearClienteLibsql } from '@/utils/libsql.js'

export class CuentasRemuneradasUsdDatabaseService {
  constructor(url, authToken) {
    this.db = crearClienteLibsql({
      scope: 'cuentas-remuneradas-usd',
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunner(
      this.db,
      'cuentas-remuneradas-usd',
    )
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async insertCuentaRemuneradaUsd(entidad, tasa, tope, timestamp) {
    await this.db.execute({
      sql: `
        INSERT INTO cuentas_remuneradas_usd (entidad, tasa, tope, timestamp)
        VALUES (?, ?, ?, ?)
      `,
      args: [entidad, tasa, tope, timestamp],
    })
  }

  async getLatestCuentaRemuneradaByEntity(entidad) {
    const resultado = await this.db.execute({
      sql: `
        SELECT id, entidad, tasa, tope, timestamp
        FROM cuentas_remuneradas_usd
        WHERE entidad = ?
        ORDER BY timestamp DESC, created_at DESC
        LIMIT 1
      `,
      args: [entidad],
    })

    if (resultado.rows.length === 0) {
      return null
    }

    const row = resultado.rows[0]

    return {
      id: row.id,
      entidad: row.entidad,
      tasa: row.tasa,
      tope: row.tope,
      timestamp: row.timestamp,
    }
  }

  async getAllLatestCuentasRemuneradasUsd() {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM cuentas_remuneradas_usd c
        INNER JOIN (
          SELECT entidad, MAX(timestamp) AS max_timestamp
          FROM cuentas_remuneradas_usd
          GROUP BY entidad
        ) latest ON c.entidad = latest.entidad
          AND c.timestamp = latest.max_timestamp
        ORDER BY c.entidad
      `,
    })

    return resultado.rows.map(row => ({
      id: row.id,
      entidad: row.entidad,
      tasa: row.tasa,
      tope: row.tope,
      timestamp: row.timestamp,
    }))
  }

  close() {
    this.db.close()
  }
}
