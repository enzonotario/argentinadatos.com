import { escribirRuta } from '@/utils/rutas.js'

export async function guardarPrestamosPersonales(items) {
  return escribirRuta('/finanzas/creditos/prestamosPersonales', items)
}
