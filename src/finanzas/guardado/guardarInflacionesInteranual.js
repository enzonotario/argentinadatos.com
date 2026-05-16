import { escribirRuta } from '@/utils/rutas.js'
import { leerRuta } from '@/utils/rutas.js'
import { ordenarPorFecha } from '@/utils/data.js'

export async function guardarInflacionesInteranual(items) {
  const actual = await leerRuta('/finanzas/indices/inflacionInteranual')

  for (const item of items) {
    if (!actual.find(i => i.fecha === item.fecha)) {
      actual.push(item)
    }
  }

  return escribirRuta(
    '/finanzas/indices/inflacionInteranual',
    ordenarPorFecha(actual),
  )
}
