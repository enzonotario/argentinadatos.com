import { andFilters, eq } from '../filter.js'
import { toPocketBaseDate } from '../dates.js'
import {
  findFirstRecord,
  listAllRecords,
  upsertByFilter,
} from '../records.js'

export class LetrasRepository {
  constructor(pb) {
    this.pb = pb
  }

  async upsertLetra(ticker, fechaEmision, fechaVencimiento, tem, vpv) {
    await upsertByFilter(this.pb, 'letras', eq('ticker', ticker), {
      ticker,
      fechaEmision: fechaEmision ?? null,
      fechaVencimiento,
      tem: tem ?? null,
      vpv,
      fechaActualizacion: toPocketBaseDate(new Date()),
    })
  }

  async getAllLetras() {
    const rows = await listAllRecords(this.pb, 'letras', {
      sort: 'fechaVencimiento',
    })
    return rows.map(row => ({
      ticker: row.ticker,
      fechaEmision: row.fechaEmision ?? null,
      fechaVencimiento: row.fechaVencimiento,
      tem: row.tem ?? null,
      vpv: row.vpv,
    }))
  }

  async deleteLetrasExcept(tickers) {
    const rows = await listAllRecords(this.pb, 'letras')
    const keep = new Set(tickers ?? [])
    for (const row of rows) {
      if (!keep.has(row.ticker)) {
        await this.pb.deleteRecord('letras', row.id)
      }
    }
  }
}

export class CriptopesosRepository {
  constructor(pb) {
    this.pb = pb
  }

  async insertCriptopeso(token, entidad, tna, timestamp) {
    await this.pb.createRecord('criptopesos', {
      token,
      entidad,
      tna,
      timestamp,
    })
  }

  async getLatestCriptopesoByEntity(token, entidad) {
    const row = await findFirstRecord(this.pb, 'criptopesos', {
      filter: andFilters(eq('token', token), eq('entidad', entidad)),
      sort: '-timestamp',
    })
    if (!row) return null
    return {
      id: row.id,
      token: row.token,
      entidad: row.entidad,
      tna: row.tna,
      timestamp: row.timestamp,
    }
  }

  async getAllLatestCriptopesos() {
    const rows = await listAllRecords(this.pb, 'criptopesos', {
      sort: 'entidad,token,-timestamp',
    })
    const latest = new Map()
    for (const row of rows) {
      const key = `${row.token}::${row.entidad}`
      if (!latest.has(key)) {
        latest.set(key, {
          id: row.id,
          token: row.token,
          entidad: row.entidad,
          tna: row.tna,
          timestamp: row.timestamp,
        })
      }
    }
    return [...latest.values()].sort((a, b) =>
      a.entidad === b.entidad
        ? a.token.localeCompare(b.token)
        : a.entidad.localeCompare(b.entidad),
    )
  }
}

export class CuentasRemuneradasUsdRepository {
  constructor(pb) {
    this.pb = pb
  }

  async insertCuentaRemuneradaUsd(entidad, tasa, tope, timestamp) {
    await this.pb.createRecord('cuentas_remuneradas_usd', {
      entidad,
      tasa,
      tope: tope ?? null,
      timestamp,
    })
  }

  async getLatestCuentaRemuneradaByEntity(entidad) {
    const row = await findFirstRecord(this.pb, 'cuentas_remuneradas_usd', {
      filter: eq('entidad', entidad),
      sort: '-timestamp',
    })
    if (!row) return null
    return {
      id: row.id,
      entidad: row.entidad,
      tasa: row.tasa,
      tope: row.tope ?? null,
      timestamp: row.timestamp,
    }
  }

  async getAllLatestCuentasRemuneradasUsd() {
    const rows = await listAllRecords(this.pb, 'cuentas_remuneradas_usd', {
      sort: 'entidad,-timestamp',
    })
    const latest = new Map()
    for (const row of rows) {
      if (!latest.has(row.entidad)) {
        latest.set(row.entidad, {
          id: row.id,
          entidad: row.entidad,
          tasa: row.tasa,
          tope: row.tope ?? null,
          timestamp: row.timestamp,
        })
      }
    }
    return [...latest.values()].sort((a, b) =>
      a.entidad.localeCompare(b.entidad),
    )
  }
}
