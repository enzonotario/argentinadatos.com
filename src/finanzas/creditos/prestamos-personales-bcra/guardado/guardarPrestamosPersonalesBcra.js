import { escribirRuta } from '@/utils/rutas.js'

export async function guardarPrestamosPersonalesBcra(items) {
  return escribirRuta('/finanzas/creditos/prestamosPersonalesBcra', items)
}
