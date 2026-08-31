import { createPocketBaseClient } from '../client.js'
import { toPocketBaseDate } from '../dates.js'
import { listAllRecords } from '../records.js'
import {
  caucionSerieKey,
  classifyCaucionMoneda,
  fechaOperacionHoy,
  mergeTasaMinMaxDia,
} from '../schema/cauciones.js'

function rowFechaOperacion(row) {
  return row.fechaOperacion ?? null
}

/**
 * Índice de min/max ya guardados por (moneda, plazo).
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
 */
export async function replaceCauciones(
  payload,
  pb = createPocketBaseClient(),
) {
  const titulos = Array.isArray(payload?.titulos) ? payload.titulos : []
  const fechaActualizacion = toPocketBaseDate(new Date())
  const fechaOperacion = fechaOperacionHoy()
  const byMoneda = { ars: 0, usd: 0 }

  const existingRows = await listAllRecords(pb, 'cauciones')
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
  return listAllRecords(pb, 'cauciones', {
    filter: `moneda = "${moneda}"`,
    sort: 'plazo',
  })
}
