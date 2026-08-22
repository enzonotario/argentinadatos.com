/** Schema idempotente de la colección `cauciones` (filas normalizadas). */
export const CAUCIONES_COLLECTION = {
  name: 'cauciones',
  type: 'base',
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
  fields: [
    {
      name: 'plazo',
      type: 'number',
      required: true,
      onlyInt: true,
    },
    {
      name: 'montoContado',
      type: 'number',
      required: true,
    },
    {
      name: 'tasaActual',
      type: 'number',
      required: true,
    },
    {
      name: 'tasaMinDia',
      type: 'number',
      required: true,
    },
    {
      name: 'tasaMaxDia',
      type: 'number',
      required: true,
    },
    {
      name: 'fechaOperacion',
      type: 'text',
      required: true,
      max: 10,
    },
    {
      name: 'fechaVencimiento',
      type: 'date',
      required: true,
    },
    {
      name: 'moneda',
      type: 'text',
      required: true,
      max: 3,
    },
    {
      name: 'syncedAt',
      type: 'date',
      required: true,
    },
  ],
  indexes: [
    'CREATE INDEX idx_cauciones_synced_at ON cauciones (syncedAt)',
    'CREATE INDEX idx_cauciones_moneda ON cauciones (moneda)',
    'CREATE INDEX idx_cauciones_moneda_plazo ON cauciones (moneda, plazo)',
  ],
}

/**
 * IOL no envía moneda; el panel mezcla ARS (TNA ~15%+) y USD (TNA ~0–5%).
 * Gap observado típico ~3% vs ~18% → umbral 10.
 */
export function classifyCaucionMoneda(tasaActual) {
  const tasa = Number(tasaActual)
  if (!Number.isFinite(tasa)) {
    throw new Error(`Invalid tasaActual: ${tasaActual}`)
  }
  return tasa < 10 ? 'usd' : 'ars'
}

/** Día hábil/operativo en Argentina (YYYY-MM-DD). */
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

/**
 * Combina min/max del día previo con las tasas del snapshot actual.
 * Si cambió el día operativo, reinicia el rango con el snapshot.
 */
export function mergeTasaMinMaxDia({
  existing,
  snapshotTasas,
  fechaOperacion,
}) {
  const tasas = snapshotTasas
    .map(Number)
    .filter(n => Number.isFinite(n))
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
