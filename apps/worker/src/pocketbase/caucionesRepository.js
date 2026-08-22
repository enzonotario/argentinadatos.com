import { createPocketBaseClient } from './client.js'
import {
  caucionSerieKey,
  classifyCaucionMoneda,
  fechaOperacionHoy,
  mergeTasaMinMaxDia,
} from './schema/cauciones.js'

function toPocketBaseDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid date: ${value}`)
    }
    return value.toISOString().replace('T', ' ')
  }

  const str = String(value)
  // Evitar corrimiento de día por timezone en fechas de calendario de IOL.
  const day = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (day) {
    return `${day[1]} 00:00:00.000Z`
  }

  const date = new Date(str)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }
  return date.toISOString().replace('T', ' ')
}

function rowFechaOperacion(row) {
  return row.fechaOperacion ?? null
}

async function listAllCauciones(pb) {
  const items = []
  let page = 1
  const perPage = 200
  for (;;) {
    const result = await pb.listRecords('cauciones', { page, perPage })
    items.push(...(result.items ?? []))
    if (page >= (result.totalPages ?? 1)) break
    page += 1
  }
  return items
}

/**
 * Índice de min/max ya guardados por (moneda, plazo).
 * Si hay varias filas de la misma serie, se unifica el rango.
 */
export function buildExistingMinMaxBySerie(existingRows) {
  const map = new Map()
  for (const row of existingRows) {
    if (!row?.moneda || row.plazo == null) continue
    const key = caucionSerieKey(row.moneda, row.plazo)
    const fechaOperacion = rowFechaOperacion(row)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, {
        tasaMinDia: Number(row.tasaMinDia),
        tasaMaxDia: Number(row.tasaMaxDia),
        fechaOperacion,
      })
      continue
    }
    // Misma fecha → ensanchar; distinta → quedarse con la más reciente si se puede
    if (fechaOperacion === prev.fechaOperacion) {
      if (Number.isFinite(Number(row.tasaMinDia))) {
        prev.tasaMinDia = Math.min(prev.tasaMinDia, Number(row.tasaMinDia))
      }
      if (Number.isFinite(Number(row.tasaMaxDia))) {
        prev.tasaMaxDia = Math.max(prev.tasaMaxDia, Number(row.tasaMaxDia))
      }
    } else if (
      String(fechaOperacion || '') > String(prev.fechaOperacion || '')
    ) {
      map.set(key, {
        tasaMinDia: Number(row.tasaMinDia),
        tasaMaxDia: Number(row.tasaMaxDia),
        fechaOperacion,
      })
    }
  }
  return map
}

/**
 * Reemplaza el snapshot de cauciones preservando min/max del día por (moneda, plazo).
 * IOL envía `tasaPromedio`; se persiste como `tasaActual`.
 * @param {{ titulos: Array<{ plazo: number, montoContado: number, tasaPromedio: number, fechaVencimiento: string }> }} payload
 */
export async function replaceCauciones(payload, pb = createPocketBaseClient()) {
  const titulos = Array.isArray(payload?.titulos) ? payload.titulos : []
  const fechaActualizacion = toPocketBaseDate(new Date())
  const fechaOperacion = fechaOperacionHoy()
  const byMoneda = { ars: 0, usd: 0 }

  const existingRows = await listAllCauciones(pb)
  const existingBySerie = buildExistingMinMaxBySerie(existingRows)

  const enriched = titulos.map(titulo => {
    const tasaActual = Number(titulo.tasaPromedio)
    const moneda = classifyCaucionMoneda(tasaActual)
    return {
      ...titulo,
      moneda,
      tasaActual,
      plazo: Number(titulo.plazo),
      montoContado: Number(titulo.montoContado),
    }
  })

  const tasasBySerie = new Map()
  for (const titulo of enriched) {
    const key = caucionSerieKey(titulo.moneda, titulo.plazo)
    if (!tasasBySerie.has(key)) tasasBySerie.set(key, [])
    tasasBySerie.get(key).push(titulo.tasaActual)
  }

  const minMaxBySerie = new Map()
  for (const [key, snapshotTasas] of tasasBySerie) {
    minMaxBySerie.set(
      key,
      mergeTasaMinMaxDia({
        existing: existingBySerie.get(key),
        snapshotTasas,
        fechaOperacion,
      }),
    )
  }

  await pb.truncateCollection('cauciones')

  let created = 0
  for (const titulo of enriched) {
    const key = caucionSerieKey(titulo.moneda, titulo.plazo)
    const range = minMaxBySerie.get(key)
    byMoneda[titulo.moneda] = (byMoneda[titulo.moneda] ?? 0) + 1
    await pb.createRecord('cauciones', {
      plazo: titulo.plazo,
      montoContado: titulo.montoContado,
      tasaActual: titulo.tasaActual,
      tasaMinDia: range.tasaMinDia,
      tasaMaxDia: range.tasaMaxDia,
      fechaOperacion: range.fechaOperacion,
      fechaVencimiento: toPocketBaseDate(titulo.fechaVencimiento),
      moneda: titulo.moneda,
      fechaActualizacion,
    })
    created += 1
  }

  return { created, fechaActualizacion, byMoneda, fechaOperacion }
}

/**
 * @param {'ars' | 'usd'} moneda
 */
export async function listCaucionesByMoneda(
  moneda,
  pb = createPocketBaseClient(),
) {
  const items = []
  let page = 1
  const perPage = 200

  for (;;) {
    const result = await pb.listRecords('cauciones', {
      page,
      perPage,
      sort: 'fechaVencimiento,plazo',
      filter: `moneda='${moneda}'`,
    })
    for (const row of result.items ?? []) {
      items.push({
        plazo: row.plazo,
        montoContado: row.montoContado,
        tasaActual: row.tasaActual,
        tasaMinDia: row.tasaMinDia,
        tasaMaxDia: row.tasaMaxDia,
        fechaOperacion: rowFechaOperacion(row),
        fechaActualizacion: row.fechaActualizacion ?? null,
        fechaVencimiento: normalizeFechaVencimiento(row.fechaVencimiento),
      })
    }
    if (page >= (result.totalPages ?? 1)) break
    page += 1
  }

  return items
}

function normalizeFechaVencimiento(value) {
  if (!value) return value
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return `${match[1]}T00:00:00`
  return value
}
