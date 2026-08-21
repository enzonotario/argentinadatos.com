import { createPocketBaseClient } from './client.js'

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

/**
 * Reemplaza todas las filas de cauciones con el snapshot actual de IOL.
 * @param {{ titulos: Array<{ plazo: number, montoContado: number, tasaPromedio: number, fechaVencimiento: string }> }} payload
 */
export async function replaceCauciones(payload, pb = createPocketBaseClient()) {
  const titulos = Array.isArray(payload?.titulos) ? payload.titulos : []
  const syncedAt = toPocketBaseDate(new Date())

  await pb.truncateCollection('cauciones')

  let created = 0
  for (const titulo of titulos) {
    await pb.createRecord('cauciones', {
      plazo: Number(titulo.plazo),
      montoContado: Number(titulo.montoContado),
      tasaPromedio: Number(titulo.tasaPromedio),
      fechaVencimiento: toPocketBaseDate(titulo.fechaVencimiento),
      syncedAt,
    })
    created += 1
  }

  return { created, syncedAt }
}

/**
 * Lee todas las filas y arma el payload público `{ titulos: [...] }`.
 */
export async function listCaucionesAsPayload(pb = createPocketBaseClient()) {
  const titulos = []
  let page = 1
  const perPage = 200

  for (;;) {
    const result = await pb.listRecords('cauciones', {
      page,
      perPage,
      sort: 'fechaVencimiento,plazo',
    })
    for (const row of result.items ?? []) {
      titulos.push({
        plazo: row.plazo,
        montoContado: row.montoContado,
        tasaPromedio: row.tasaPromedio,
        fechaVencimiento: normalizeFechaVencimiento(row.fechaVencimiento),
      })
    }
    if (page >= (result.totalPages ?? 1)) break
    page += 1
  }

  return { titulos }
}

function normalizeFechaVencimiento(value) {
  if (!value) return value
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return `${match[1]}T00:00:00`
  return value
}
