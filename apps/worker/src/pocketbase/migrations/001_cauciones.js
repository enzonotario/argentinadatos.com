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
      name: 'tasaPromedio',
      type: 'number',
      required: true,
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
    "CREATE INDEX idx_cauciones_moneda ON cauciones (moneda)",
  ],
}

/**
 * IOL no envía moneda; el panel mezcla ARS (TNA ~15%+) y USD (TNA ~0–5%).
 * Gap observado típico ~3% vs ~18% → umbral 10.
 */
export function classifyCaucionMoneda(tasaPromedio) {
  const tasa = Number(tasaPromedio)
  if (!Number.isFinite(tasa)) {
    throw new Error(`Invalid tasaPromedio: ${tasaPromedio}`)
  }
  return tasa < 10 ? 'usd' : 'ars'
}
