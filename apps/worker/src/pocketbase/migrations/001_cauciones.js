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
      name: 'syncedAt',
      type: 'date',
      required: true,
    },
  ],
  indexes: ['CREATE INDEX idx_cauciones_synced_at ON cauciones (syncedAt)'],
}
