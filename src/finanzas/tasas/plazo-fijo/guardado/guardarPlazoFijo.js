import { escribirRuta, leerRuta } from '@/utils/rutas.js'

export async function guardarPlazoFijo(items) {
  return escribirRuta('/finanzas/tasas/plazoFijo', items)
}
