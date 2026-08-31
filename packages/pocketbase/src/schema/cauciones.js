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
