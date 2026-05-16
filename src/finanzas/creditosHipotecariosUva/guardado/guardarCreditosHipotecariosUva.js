import { escribirRuta } from '@/utils/rutas.js'

export async function guardarCreditosHipotecariosUva(items) {
  return escribirRuta('/finanzas/creditos/hipotecariosUva', items)
}
