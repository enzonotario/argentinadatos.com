import { escribirRuta } from '@/utils/rutas.js'
import { leerRuta } from '@/utils/rutas.js'
import { format } from 'date-fns'

export async function guardarRendimientos(entidad, items) {
  return escribirRuta(
    `/finanzas/rendimientos/${entidad}`,
    items.map(item => ({
      moneda: item.moneda,
      apy: item.apy,
      fecha: item.fecha,
    })),
  )
}
