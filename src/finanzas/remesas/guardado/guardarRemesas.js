import { escribirRuta } from '@/utils/rutas.js'

export async function guardarRemesas(payload) {
  escribirRuta('/finanzas/remesas', payload)
}
