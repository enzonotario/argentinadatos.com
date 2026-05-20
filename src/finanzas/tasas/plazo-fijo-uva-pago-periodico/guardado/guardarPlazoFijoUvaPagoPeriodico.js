import { escribirRuta, leerRuta } from '@/utils/rutas.js'

export async function guardarPlazoFijoUvaPagoPeriodico(proveedores) {
  if (proveedores === null || proveedores === undefined) {
    console.error(
      'No se extrajeron proveedores de plazo fijo UVA con pago periódico. Se preserva la extracción anterior.',
    )
    return leerRuta('/finanzas/tasas/plazoFijoUvaPagoPeriodico')
  }

  return escribirRuta('/finanzas/tasas/plazoFijoUvaPagoPeriodico', proveedores)
}
