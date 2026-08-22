import { listAllRecords } from '../pocketbase.js'

function fechaVencimientoPublica(value) {
  if (!value) return value
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return `${match[1]}T00:00:00`
  return value
}

function mapRow(row) {
  return {
    plazo: row.plazo,
    montoContado: row.montoContado,
    tasaPromedio: row.tasaPromedio,
    fechaVencimiento: fechaVencimientoPublica(row.fechaVencimiento),
  }
}

/**
 * @param {'ars' | 'usd'} moneda
 * @returns {Promise<Array<{ plazo: number, montoContado: number, tasaPromedio: number, fechaVencimiento: string }>>}
 */
export async function loadCaucionesByMoneda(moneda) {
  const rows = await listAllRecords('cauciones', {
    sort: 'fechaVencimiento,plazo',
    filter: `moneda='${moneda}'`,
  })
  return rows.map(mapRow)
}

export function loadCaucionesArs() {
  return loadCaucionesByMoneda('ars')
}

export function loadCaucionesUsd() {
  return loadCaucionesByMoneda('usd')
}
