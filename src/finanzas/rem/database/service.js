import { MigrationRunner } from './migrations/migration-runner.js'
import { crearClienteLibsql } from '@/utils/libsql.js'

export class RemDatabaseService {
  constructor(url, authToken) {
    this.db = crearClienteLibsql({
      scope: 'rem',
      url,
      authToken,
    })
    this.migrationRunner = new MigrationRunner(this.db, 'rem')
  }

  async initialize() {
    await this.migrationRunner.runPendingMigrations()
  }

  async deleteAllExpectativas() {
    await this.db.execute('DELETE FROM rem_expectativas')
  }

  async deleteInforme(informe) {
    await this.db.execute({
      sql: 'DELETE FROM rem_expectativas WHERE informe = ?',
      args: [informe],
    })
  }

  async upsertExpectativa(item) {
    await this.db.execute({
      sql: `
        INSERT INTO rem_expectativas (
          informe, fecha, muestra, indicador, periodo, periodoTipo, periodoDesde,
          periodoHasta, referencia, referenciaFecha, unidad, mediana, promedio,
          desvio, maximo, minimo, percentil90, percentil75, percentil25,
          percentil10, participantes, fuente, publicacionUrl, xlsxUrl,
          fechaActualizacion
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(informe, muestra, indicador, periodo, referencia) DO UPDATE SET
          fecha = excluded.fecha,
          periodoTipo = excluded.periodoTipo,
          periodoDesde = excluded.periodoDesde,
          periodoHasta = excluded.periodoHasta,
          referenciaFecha = excluded.referenciaFecha,
          unidad = excluded.unidad,
          mediana = excluded.mediana,
          promedio = excluded.promedio,
          desvio = excluded.desvio,
          maximo = excluded.maximo,
          minimo = excluded.minimo,
          percentil90 = excluded.percentil90,
          percentil75 = excluded.percentil75,
          percentil25 = excluded.percentil25,
          percentil10 = excluded.percentil10,
          participantes = excluded.participantes,
          fuente = excluded.fuente,
          publicacionUrl = excluded.publicacionUrl,
          xlsxUrl = excluded.xlsxUrl,
          fechaActualizacion = datetime('now')
      `,
      args: [
        item.informe,
        item.fecha,
        item.muestra,
        item.indicador,
        item.periodo,
        item.periodoTipo,
        item.periodoDesde,
        item.periodoHasta,
        item.referencia,
        item.referenciaFecha,
        item.unidad,
        item.mediana,
        item.promedio,
        item.desvio,
        item.maximo,
        item.minimo,
        item.percentil90,
        item.percentil75,
        item.percentil25,
        item.percentil10,
        item.participantes,
        item.src ?? item.fuente ?? null,
        item.publicacionUrl,
        item.xlsxUrl,
      ],
    })
  }

  mapRow(row) {
    return {
      informe: row.informe,
      fecha: row.fecha,
      muestra: row.muestra,
      indicador: row.indicador,
      periodo: row.periodo,
      periodoTipo: row.periodoTipo,
      periodoDesde: row.periodoDesde,
      periodoHasta: row.periodoHasta,
      referencia: row.referencia,
      referenciaFecha: row.referenciaFecha,
      unidad: row.unidad,
      mediana: row.mediana,
      promedio: row.promedio,
      desvio: row.desvio,
      maximo: row.maximo,
      minimo: row.minimo,
      percentil90: row.percentil90,
      percentil75: row.percentil75,
      percentil25: row.percentil25,
      percentil10: row.percentil10,
      participantes: row.participantes,
      fuente: row.src,
      publicacionUrl: row.publicacionUrl,
      xlsxUrl: row.xlsxUrl,
    }
  }

  async getAllExpectativas() {
    const result = await this.db.execute(`
      SELECT * FROM rem_expectativas
      ORDER BY informe DESC, muestra ASC, indicador ASC, periodoDesde ASC, periodo ASC
    `)

    return result.rows.map(row => this.mapRow(row))
  }

  async getLatestExpectativas() {
    const result = await this.db.execute(`
      SELECT * FROM rem_expectativas
      WHERE informe = (SELECT MAX(informe) FROM rem_expectativas)
      ORDER BY muestra ASC, indicador ASC, periodoDesde ASC, periodo ASC
    `)

    return result.rows.map(row => this.mapRow(row))
  }

  close() {
    this.db.close()
  }
}
