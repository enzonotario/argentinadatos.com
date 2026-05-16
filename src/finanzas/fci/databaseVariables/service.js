import { createClient } from '@libsql/client'
import { MigrationRunnerVariables } from './migrations/migration-runner.js'

export class FciVariablesDatabaseService {
  constructor(url, authToken) {
    this.db = createClient({
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunnerVariables(
      this.db,
      'fci-variables',
    )
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async insertFciVariables(
    nombre,
    fondo,
    tipo,
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
        INSERT INTO fci_variables (nombre, fondo, tipo, tna, tea, tope, fecha, condiciones, condicionesCorto, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        nombre,
        fondo,
        tipo,
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

  async getLatestFciVariablesByNombre(nombre) {
    const resultado = await this.db.execute({
      sql: `
        SELECT id, nombre, fondo, tipo, tna, tea, tope, fecha, condiciones, condicionesCorto, timestamp
        FROM fci_variables
        WHERE nombre = ?
        ORDER BY timestamp DESC, created_at DESC
        LIMIT 1
      `,
      args: [nombre],
    })

    if (resultado.rows.length === 0) {
      return null
    }

    const row = resultado.rows[0]

    return {
      id: row.id,
      nombre: row.nombre,
      fondo: row.fondo,
      tipo: row.tipo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }
  }

  async getAllLatestFciVariables() {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM fci_variables c
        INNER JOIN (
          SELECT nombre, MAX(timestamp) AS max_timestamp
          FROM fci_variables
          WHERE nombre IS NOT NULL
          GROUP BY nombre
        ) latest ON c.nombre = latest.nombre
          AND c.timestamp = latest.max_timestamp
        ORDER BY c.nombre
      `,
    })

    return resultado.rows.map(row => ({
      id: row.id,
      nombre: row.nombre,
      fondo: row.fondo,
      tipo: row.tipo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getPenultimoFciVariables() {
    const resultado = await this.db.execute({
      sql: `
        SELECT c.*
        FROM fci_variables c
        INNER JOIN (
          SELECT nombre, MAX(timestamp) AS max_timestamp
          FROM fci_variables c2
          WHERE c2.timestamp < (
            SELECT MAX(timestamp)
            FROM fci_variables c3
            WHERE c3.nombre = c2.nombre
          )
          GROUP BY nombre
        ) penultimo ON c.nombre = penultimo.nombre
          AND c.timestamp = penultimo.max_timestamp
        ORDER BY c.nombre
      `,
    })

    return resultado.rows.map(row => ({
      id: row.id,
      nombre: row.nombre,
      fondo: row.fondo,
      tipo: row.tipo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getHistorialPorNombre(nombre) {
    const resultado = await this.db.execute({
      sql: `
        SELECT id, nombre, fondo, tipo, tna, tea, tope, fecha, condiciones, condicionesCorto, timestamp
        FROM fci_variables
        WHERE nombre = ?
        ORDER BY fecha ASC, timestamp ASC
      `,
      args: [nombre],
    })

    return resultado.rows.map(row => ({
      id: row.id,
      nombre: row.nombre,
      fondo: row.fondo,
      tipo: row.tipo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope,
      fecha: row.fecha,
      condiciones: row.condiciones,
      condicionesCorto: row.condicionesCorto,
      timestamp: row.timestamp,
    }))
  }

  async getAllNombres() {
    const resultado = await this.db.execute({
      sql: `
        SELECT DISTINCT nombre
        FROM fci_variables
        WHERE nombre IS NOT NULL
        ORDER BY nombre
      `,
    })

    return resultado.rows.map(row => row.nombre)
  }

  close() {
    this.db.close()
  }
}
