import { escribirRuta } from '@/utils/rutas.js'
import { leerRuta } from '@/utils/rutas.js'
import { ordenarPorFecha } from '@/utils/data.js'

export async function guardarTasasDepositos30Dias(items) {
  const ruta = '/finanzas/tasas/depositos30Dias'

  const actual = await leerRuta(ruta)

  for (const item of items) {
    if (!actual.find(i => i.fecha === item.fecha)) {
      actual.push(item)
    }
  }

  return escribirRuta(ruta, ordenarPorFecha(actual))
}
