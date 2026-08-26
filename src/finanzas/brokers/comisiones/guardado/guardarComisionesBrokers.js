import { escribirRuta } from '@/utils/rutas.js'

export async function guardarComisionesBrokers(payload) {
  return escribirRuta('/finanzas/brokers/comisiones', payload)
}
