import { escribirRuta } from '@/utils/rutas.js'

export async function guardarBonosCer(payload) {
  escribirRuta('/finanzas/bonos-cer', payload)
}
