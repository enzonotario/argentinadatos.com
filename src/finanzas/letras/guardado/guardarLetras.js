import { escribirRuta } from '@/utils/rutas.js'

export async function guardarLetras(payload) {
  escribirRuta('/finanzas/letras', payload)
}
