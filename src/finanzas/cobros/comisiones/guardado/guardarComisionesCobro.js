import { escribirRuta } from '@/utils/rutas.js'

export async function guardarComisionesCobro(payload) {
  return escribirRuta('/finanzas/cobros/comisiones', payload)
}
