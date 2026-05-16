import { escribirRuta } from '@/utils/rutas.js'

export async function guardarPlazoFijoPrecancelable(proveedores) {
  return escribirRuta('/finanzas/tasas/plazoFijoPrecancelable', proveedores)
}
