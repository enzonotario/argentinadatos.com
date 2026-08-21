import { listAllRecords } from '../pocketbase.js'

function fechaVencimientoPublica(value) {
  if (!value) return value
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return `${match[1]}T00:00:00`
  return value
}

/**
 * Payload público: misma forma que IOL `{ titulos: [...] }`.
 */
export async function loadCauciones() {
  const rows = await listAllRecords('cauciones', {
    sort: 'fechaVencimiento,plazo',
  })

  return {
    titulos: rows.map(row => ({
      plazo: row.plazo,
      montoContado: row.montoContado,
      tasaPromedio: row.tasaPromedio,
      fechaVencimiento: fechaVencimientoPublica(row.fechaVencimiento),
    })),
  }
}
