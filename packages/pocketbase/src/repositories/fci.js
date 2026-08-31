import { eq } from '../filter.js'
import { findFirstRecord, listAllRecords } from '../records.js'

function mapFciOtrosRow(row) {
  return {
    id: row.id,
    fondo: row.fondo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope ?? null,
    fecha: row.fecha,
    condiciones: row.condiciones ?? null,
    condicionesCorto: row.condicionesCorto ?? null,
    plazoMinDias: row.plazoMinDias ?? null,
    plazoMaxDias: row.plazoMaxDias ?? null,
    timestamp: row.timestamp,
  }
}

function mapFciVariablesRow(row) {
  return {
    id: row.id,
    nombre: row.nombre ?? null,
    fondo: row.fondo,
    tipo: row.tipo ?? null,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope ?? null,
    fecha: row.fecha,
    condiciones: row.condiciones ?? null,
    condicionesCorto: row.condicionesCorto ?? null,
    timestamp: row.timestamp,
  }
}

function latestByKey(rows, keyFn) {
  const latest = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (key == null) continue
    const prev = latest.get(key)
    if (!prev || String(row.timestamp) >= String(prev.timestamp)) {
      latest.set(key, row)
    }
  }
  return [...latest.values()]
}

function penultimoByKey(rows, keyFn) {
  const byKey = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (key == null) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  }
  const result = []
  for (const group of byKey.values()) {
    group.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    if (group.length >= 2) result.push(group[1])
  }
  return result
}

export class FciOtrosRepository {
  constructor(pb) {
    this.pb = pb
  }

  async insertFciOtros(
    fondo,
    tna,
    tea,
    tope,
    fecha,
    condiciones,
    condicionesCorto,
    plazoMinDias,
    plazoMaxDias,
    timestamp,
  ) {
    await this.pb.createRecord('fci_otros', {
      fondo,
      tna,
      tea,
      tope: tope ?? null,
      fecha,
      condiciones: condiciones ?? null,
      condicionesCorto: condicionesCorto ?? null,
      plazoMinDias: plazoMinDias ?? null,
      plazoMaxDias: plazoMaxDias ?? null,
      timestamp,
    })
  }

  async getLatestFciOtrosByFondo(fondo) {
    const row = await findFirstRecord(this.pb, 'fci_otros', {
      filter: eq('fondo', fondo),
      sort: '-timestamp',
    })
    return row ? mapFciOtrosRow(row) : null
  }

  async getAllLatestFciOtros() {
    const rows = await listAllRecords(this.pb, 'fci_otros')
    return latestByKey(rows, r => r.fondo)
      .map(mapFciOtrosRow)
      .sort((a, b) => a.fondo.localeCompare(b.fondo))
  }

  async getFciOtrosByFecha(fecha) {
    const rows = await listAllRecords(this.pb, 'fci_otros', {
      filter: eq('fecha', fecha),
    })
    return latestByKey(rows, r => r.fondo)
      .map(mapFciOtrosRow)
      .sort((a, b) => a.fondo.localeCompare(b.fondo))
  }

  async getPenultimoFciOtros() {
    const rows = await listAllRecords(this.pb, 'fci_otros')
    return penultimoByKey(rows, r => r.fondo)
      .map(mapFciOtrosRow)
      .sort((a, b) => a.fondo.localeCompare(b.fondo))
  }

  async getHistorialPorFondo(fondo) {
    const rows = await listAllRecords(this.pb, 'fci_otros', {
      filter: eq('fondo', fondo),
      sort: 'fecha,timestamp',
    })
    return rows.map(mapFciOtrosRow)
  }

  async getAllFondos() {
    const rows = await listAllRecords(this.pb, 'fci_otros')
    return [...new Set(rows.map(r => r.fondo))].sort()
  }
}

export class FciVariablesRepository {
  constructor(pb) {
    this.pb = pb
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
    await this.pb.createRecord('fci_variables', {
      nombre: nombre ?? null,
      fondo,
      tipo: tipo ?? null,
      tna,
      tea,
      tope: tope ?? null,
      fecha,
      condiciones: condiciones ?? null,
      condicionesCorto: condicionesCorto ?? null,
      timestamp,
    })
  }

  async getLatestFciVariablesByNombre(nombre) {
    const row = await findFirstRecord(this.pb, 'fci_variables', {
      filter: eq('nombre', nombre),
      sort: '-timestamp',
    })
    return row ? mapFciVariablesRow(row) : null
  }

  async getAllLatestFciVariables() {
    const rows = await listAllRecords(this.pb, 'fci_variables')
    return latestByKey(
      rows.filter(r => r.nombre != null),
      r => r.nombre,
    )
      .map(mapFciVariablesRow)
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
  }

  async getPenultimoFciVariables() {
    const rows = await listAllRecords(this.pb, 'fci_variables')
    return penultimoByKey(
      rows.filter(r => r.nombre != null),
      r => r.nombre,
    )
      .map(mapFciVariablesRow)
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
  }

  async getHistorialPorNombre(nombre) {
    const rows = await listAllRecords(this.pb, 'fci_variables', {
      filter: eq('nombre', nombre),
      sort: 'fecha,timestamp',
    })
    return rows.map(mapFciVariablesRow)
  }

  async getAllNombres() {
    const rows = await listAllRecords(this.pb, 'fci_variables')
    return [...new Set(rows.map(r => r.nombre).filter(Boolean))].sort()
  }
}
