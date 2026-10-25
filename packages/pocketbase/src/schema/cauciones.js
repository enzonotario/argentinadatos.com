import { PRIVATE_RULES, dateField, numberField, textField } from './fields.js'

/** Schema objetivo de la colección `cauciones`. */
export const CAUCIONES_COLLECTION = {
  name: 'cauciones',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    numberField('plazo', { required: true, onlyInt: true }),
    numberField('montoContado', { required: true }),
    numberField('tasaActual', { required: true }),
    numberField('tasaMinDia', { required: true }),
    numberField('tasaMaxDia', { required: true }),
    textField('fechaOperacion', { required: true, max: 10 }),
    dateField('fechaVencimiento', { required: true }),
    textField('moneda', { required: true, max: 3 }),
    dateField('fechaActualizacion', { required: true }),
  ],
  indexes: [
    'CREATE INDEX idx_cauciones_fecha_actualizacion ON cauciones (fechaActualizacion)',
    'CREATE INDEX idx_cauciones_moneda ON cauciones (moneda)',
    'CREATE INDEX idx_cauciones_moneda_plazo ON cauciones (moneda, plazo)',
  ],
}

export function classifyCaucionMoneda(tasaActual) {
  const tasa = Number(tasaActual)
  if (!Number.isFinite(tasa)) {
    throw new Error(`Invalid tasaActual: ${tasaActual}`)
  }
  return tasa < 10 ? 'usd' : 'ars'
}

export function fechaOperacionHoy(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function toDateOnly(value) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return fechaOperacionHoy(value)
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

function parseDateOnlyUtc(value) {
  const day = toDateOnly(value)
  if (!day) return null
  const ms = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

/** Diferencia en días calendario (UTC date-only). */
export function daysBetweenDateOnly(from, to) {
  const a = parseDateOnlyUtc(from)
  const b = parseDateOnlyUtc(to)
  if (a == null || b == null) return Number.NaN
  return Math.round((b - a) / 86_400_000)
}

/**
 * Fecha de operación implícita: vencimiento − plazo (IOL no envía fecha de rueda).
 * @returns {string | null} YYYY-MM-DD
 */
export function impliedFechaOperacion(fechaVencimiento, plazo) {
  const ms = parseDateOnlyUtc(fechaVencimiento)
  const days = Number(plazo)
  if (ms == null || !Number.isFinite(days)) return null
  return new Date(ms - days * 86_400_000).toISOString().slice(0, 10)
}

/** IOL mezcla series válidas con plazos inflados (~+160); toleramos desfaces chicos. */
export const CAUCION_PLAZO_TOLERANCIA_DIAS = 5

export function isCaucionPlazoCoherent(
  plazo,
  fechaOperacion,
  fechaVencimiento,
  tolerancia = CAUCION_PLAZO_TOLERANCIA_DIAS,
) {
  const days = daysBetweenDateOnly(fechaOperacion, fechaVencimiento)
  if (!Number.isFinite(days) || !Number.isFinite(Number(plazo))) return false
  return Math.abs(Number(plazo) - days) <= tolerancia
}

/**
 * Elige la fecha de rueda modal entre las implícitas recientes.
 * Fallback: hoy (AR) si no hay consenso usable.
 */
export function deriveFechaOperacion(
  titulos,
  { now = new Date(), maxAgeDays = 14 } = {},
) {
  const today = fechaOperacionHoy(now)
  const counts = new Map()

  for (const titulo of titulos ?? []) {
    const implied = impliedFechaOperacion(titulo.fechaVencimiento, titulo.plazo)
    if (!implied) continue
    const age = daysBetweenDateOnly(implied, today)
    if (!Number.isFinite(age) || age < 0 || age > maxAgeDays) continue
    counts.set(implied, (counts.get(implied) ?? 0) + 1)
  }

  if (counts.size === 0) return today

  let best = today
  let bestCount = -1
  for (const [date, count] of counts) {
    if (count > bestCount || (count === bestCount && date > best)) {
      best = date
      bestCount = count
    }
  }
  return best
}

/**
 * Suma días calendario a una fecha YYYY-MM-DD.
 * @returns {string | null}
 */
export function addDaysDateOnly(day, days) {
  const ms = parseDateOnlyUtc(day)
  const n = Number(days)
  if (ms == null || !Number.isFinite(n)) return null
  return new Date(ms + n * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Elige las series de la rueda.
 * Si IOL manda `fechaVencimiento` corrida (el cluster modal queda fuera de 14 días),
 * igual conserva ese cluster y publica la rueda como hoy (AR), con vencimiento = hoy + plazo.
 * @returns {{ fechaOperacion: string, titulos: object[], fechasCorridas: boolean }}
 */
export function prepareCaucionesSnapshot(titulos, options = {}) {
  const rows = Array.isArray(titulos) ? titulos : []
  const now = options.now ?? new Date()
  const today = fechaOperacionHoy(now)
  const fechaReciente = deriveFechaOperacion(rows, {
    now,
    maxAgeDays: options.maxAgeDays ?? 14,
  })
  const recientes = rows.filter(titulo =>
    isCaucionPlazoCoherent(
      titulo.plazo,
      fechaReciente,
      titulo.fechaVencimiento,
    ),
  )

  if (recientes.length > 0) {
    return {
      fechaOperacion: fechaReciente,
      titulos: recientes,
      fechasCorridas: false,
    }
  }

  const fechaModal = deriveFechaOperacion(rows, { now, maxAgeDays: 10_000 })
  if (fechaModal === today) {
    return { fechaOperacion: today, titulos: [], fechasCorridas: false }
  }

  const cluster = rows.filter(titulo =>
    isCaucionPlazoCoherent(titulo.plazo, fechaModal, titulo.fechaVencimiento),
  )
  const corregidos = cluster.flatMap(titulo => {
    const vencimiento = addDaysDateOnly(today, titulo.plazo)
    if (!vencimiento) return []
    return [{ ...titulo, fechaVencimiento: `${vencimiento}T00:00:00` }]
  })

  return {
    fechaOperacion: today,
    titulos: corregidos,
    fechasCorridas: corregidos.length > 0,
  }
}

export function caucionSerieKey(moneda, plazo) {
  return `${moneda}:${Number(plazo)}`
}

export function mergeTasaMinMaxDia({
  existing,
  snapshotTasas,
  fechaOperacion,
}) {
  const tasas = snapshotTasas.map(Number).filter(n => Number.isFinite(n))
  if (tasas.length === 0) {
    throw new Error('snapshotTasas vacío')
  }

  const snapshotMin = Math.min(...tasas)
  const snapshotMax = Math.max(...tasas)

  if (
    existing &&
    existing.fechaOperacion === fechaOperacion &&
    Number.isFinite(Number(existing.tasaMinDia)) &&
    Number.isFinite(Number(existing.tasaMaxDia))
  ) {
    return {
      tasaMinDia: Math.min(Number(existing.tasaMinDia), snapshotMin),
      tasaMaxDia: Math.max(Number(existing.tasaMaxDia), snapshotMax),
      fechaOperacion,
    }
  }

  return {
    tasaMinDia: snapshotMin,
    tasaMaxDia: snapshotMax,
    fechaOperacion,
  }
}

export function fieldNames(collection) {
  return new Set((collection.fields ?? []).map(f => f.name))
}

export function findField(collection, name) {
  return (collection.fields ?? []).find(f => f.name === name)
}
