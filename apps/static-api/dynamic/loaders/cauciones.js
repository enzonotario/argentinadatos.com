import { listAllRecords } from '../pocketbase.js'

function fechaVencimientoPublica(value) {
  if (!value) return value
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return `${match[1]}T00:00:00`
  return value
}

function tasaActualDe(row) {
  const value = row.tasaActual ?? row.tasaPromedio
  return Number(value)
}

function mapRow(row) {
  const tasaActual = tasaActualDe(row)
  return {
    plazo: row.plazo,
    montoContado: row.montoContado,
    tasaActual,
    tasaMinDia: row.tasaMinDia ?? tasaActual,
    tasaMaxDia: row.tasaMaxDia ?? tasaActual,
    fechaOperacion: row.fechaOperacion ?? null,
    fechaVencimiento: fechaVencimientoPublica(row.fechaVencimiento),
  }
}

function classifyMonedaFallback(tasaActual) {
  const tasa = Number(tasaActual)
  return Number.isFinite(tasa) && tasa < 10 ? 'usd' : 'ars'
}

function rowMoneda(row) {
  if (row.moneda === 'ars' || row.moneda === 'usd') return row.moneda
  return classifyMonedaFallback(tasaActualDe(row))
}

/**
 * @param {'ars' | 'usd'} moneda
 */
export async function loadCaucionesByMoneda(moneda) {
  try {
    const rows = await listAllRecords('cauciones', {
      sort: 'fechaVencimiento,plazo',
      filter: `moneda='${moneda}'`,
    })
    return rows.map(mapRow)
  } catch (err) {
    console.error(
      `[dynamic/cauciones] filter moneda=${moneda} failed, fallback:`,
      err?.message || err,
    )
    const rows = await listAllRecords('cauciones', {
      sort: 'fechaVencimiento,plazo',
    })
    return rows.filter(row => rowMoneda(row) === moneda).map(mapRow)
  }
}

export function loadCaucionesArs() {
  return loadCaucionesByMoneda('ars')
}

export function loadCaucionesUsd() {
  return loadCaucionesByMoneda('usd')
}
