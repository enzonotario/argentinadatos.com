import { andFilters, eq } from '../filter.js'
import { toPocketBaseDate } from '../dates.js'
import { listAllRecords, upsertByFilter } from '../records.js'

function mapRemRow(row) {
  return {
    informe: row.informe,
    fecha: row.fecha ?? null,
    muestra: row.muestra,
    indicador: row.indicador,
    periodo: row.periodo,
    periodoTipo: row.periodoTipo ?? null,
    periodoDesde: row.periodoDesde ?? null,
    periodoHasta: row.periodoHasta ?? null,
    referencia: row.referencia,
    referenciaFecha: row.referenciaFecha ?? null,
    unidad: row.unidad ?? null,
    mediana: row.mediana ?? null,
    promedio: row.promedio ?? null,
    desvio: row.desvio ?? null,
    maximo: row.maximo ?? null,
    minimo: row.minimo ?? null,
    percentil90: row.percentil90 ?? null,
    percentil75: row.percentil75 ?? null,
    percentil25: row.percentil25 ?? null,
    percentil10: row.percentil10 ?? null,
    participantes: row.participantes ?? null,
    fuente: row.fuente ?? null,
    publicacionUrl: row.publicacionUrl ?? null,
    xlsxUrl: row.xlsxUrl ?? null,
  }
}

export class RemRepository {
  constructor(pb) {
    this.pb = pb
  }

  async deleteAllExpectativas() {
    await this.pb.truncateCollection('rem_expectativas')
  }

  async deleteInforme(informe) {
    const rows = await listAllRecords(this.pb, 'rem_expectativas', {
      filter: eq('informe', informe),
    })
    for (const row of rows) {
      await this.pb.deleteRecord('rem_expectativas', row.id)
    }
  }

  async upsertExpectativa(item) {
    const body = {
      informe: item.informe,
      fecha: item.fecha ?? null,
      muestra: item.muestra,
      indicador: item.indicador,
      periodo: item.periodo,
      periodoTipo: item.periodoTipo ?? null,
      periodoDesde: item.periodoDesde ?? null,
      periodoHasta: item.periodoHasta ?? null,
      referencia: item.referencia,
      referenciaFecha: item.referenciaFecha ?? null,
      unidad: item.unidad ?? null,
      mediana: item.mediana ?? null,
      promedio: item.promedio ?? null,
      desvio: item.desvio ?? null,
      maximo: item.maximo ?? null,
      minimo: item.minimo ?? null,
      percentil90: item.percentil90 ?? null,
      percentil75: item.percentil75 ?? null,
      percentil25: item.percentil25 ?? null,
      percentil10: item.percentil10 ?? null,
      participantes: item.participantes ?? null,
      fuente: item.src ?? item.fuente ?? null,
      publicacionUrl: item.publicacionUrl ?? null,
      xlsxUrl: item.xlsxUrl ?? null,
      fechaActualizacion: toPocketBaseDate(new Date()),
    }

    await upsertByFilter(
      this.pb,
      'rem_expectativas',
      andFilters(
        eq('informe', body.informe),
        eq('muestra', body.muestra),
        eq('indicador', body.indicador),
        eq('periodo', body.periodo),
        eq('referencia', body.referencia),
      ),
      body,
    )
  }

  async getAllExpectativas() {
    const rows = await listAllRecords(this.pb, 'rem_expectativas', {
      sort: '-informe,muestra,indicador,periodoDesde,periodo',
    })
    return rows.map(mapRemRow)
  }

  async getLatestExpectativas() {
    const rows = await listAllRecords(this.pb, 'rem_expectativas')
    if (rows.length === 0) return []
    const maxInforme = rows.reduce(
      (max, row) => (String(row.informe) > String(max) ? row.informe : max),
      rows[0].informe,
    )
    return rows
      .filter(row => row.informe === maxInforme)
      .map(mapRemRow)
      .sort((a, b) => {
        const m = String(a.muestra).localeCompare(String(b.muestra))
        if (m) return m
        const i = String(a.indicador).localeCompare(String(b.indicador))
        if (i) return i
        const d = String(a.periodoDesde || '').localeCompare(
          String(b.periodoDesde || ''),
        )
        if (d) return d
        return String(a.periodo).localeCompare(String(b.periodo))
      })
  }
}
