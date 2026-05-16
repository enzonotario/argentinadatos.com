import { createClient } from '@libsql/client'
import { MigrationRunner } from './migrations/migration-runner.js'

export class FciOtrosDatabaseService {
  constructor(url, authToken) {
    this.db = createClient({
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunner(this.db, 'fci-otros')
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async insertFciOtros(
    fondo,
    tna,
    tea,
    tope,
    fecha,
    condiciones,
    condicionesCorto,
    timestamp,
  ) {
    await this.db.execute({
      sql: `
        INSERT INTO fci_otros (fondo, tna, tea, tope, fecha, condiciones, condicionesCorto, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        fondo,
        tna,
        tea,
        tope,
        fecha,
        condiciones,
        condicionesCorto,
        timestamp,
      ],
    })
  }

  async getLatestFciOtrosByFondo(fondo) {
    const resultado = await this.db.execute({
      sql: `
        SELECT id, fondo, tna, tea, tope, fecha, condiciones, condicionesCorto, timestamp
        FROM fci_otros
        WHERE fondo = ?
        ORDER BY timestamp DESC, created_at DESC
        LIMIT 1
      `,
      args: [fondo],
    })

    if (resultado.rows.length === 0) {
      return null
    }

    const row = resultado.rows[0]

    return {
      id: row.id,
      fondo: row.fondo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }
  }

  async getAllLatestFciOtros() {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM fci_otros c
        INNER JOIN (
          SELECT fondo, MAX(timestamp) AS max_timestamp
          FROM fci_otros
          GROUP BY fondo
        ) latest ON c.fondo = latest.fondo
          AND c.timestamp = latest.max_timestamp
        ORDER BY c.fondo
      `,
    })

    return resultado.rows.map(row => ({
      id: row.id,
      fondo: row.fondo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getFciOtrosByFecha(fecha) {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM fci_otros c
        INNER JOIN (
          SELECT fondo, MAX(timestamp) AS max_timestamp
          FROM fci_otros
          WHERE fecha = ?
          GROUP BY fondo
        ) latest ON c.fondo = latest.fondo
          AND c.timestamp = latest.max_timestamp
        ORDER BY c.fondo
      `,
      args: [fecha],
    })

    return resultado.rows.map(row => ({
      id: row.id,
      fondo: row.fondo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getPenultimoFciOtros() {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM fci_otros c
        INNER JOIN (
          SELECT fondo, MAX(timestamp) AS max_timestamp
          FROM fci_otros c2
          WHERE c2.timestamp < (
            SELECT MAX(timestamp)
            FROM fci_otros c3
            WHERE c3.fondo = c2.fondo
          )
          GROUP BY fondo
        ) penultimo ON c.fondo = penultimo.fondo
          AND c.timestamp = penultimo.max_timestamp
        ORDER BY c.fondo
      `,
    })

    return resultado.rows.map(row => ({
      id: row.id,
      fondo: row.fondo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getHistorialPorFondo(fondo) {
    const resultado = await this.db.execute({
      sql: `
        SELECT id, fondo, tna, tea, tope, fecha, condiciones, condicionesCorto, timestamp
        FROM fci_otros
        WHERE fondo = ?
        ORDER BY fecha ASC, timestamp ASC
      `,
      args: [fondo],
    })

    return resultado.rows.map(row => ({
      id: row.id,
      fondo: row.fondo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getAllFondos() {
    const resultado = await this.db.execute({
      sql: `
        SELECT DISTINCT fondo
        FROM fci_otros
        ORDER BY fondo
      `,
    })

    return resultado.rows.map(row => row.fondo)
  }

  close() {
    this.db.close()
  }
}
