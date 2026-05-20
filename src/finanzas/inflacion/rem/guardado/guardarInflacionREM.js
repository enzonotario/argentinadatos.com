import { escribirRuta } from '@/utils/rutas.js'

export async function guardarInflacionREM(items) {
  return escribirRuta('/finanzas/inflacion/rem', items)
}
