import { extraerPlazoFijoUvaPagoPeriodico } from '@/finanzas/tasas/plazo-fijo-uva-pago-periodico/extraccion/extraerPlazoFijoUvaPagoPeriodico.js'
import { guardarPlazoFijoUvaPagoPeriodico } from '@/finanzas/tasas/plazo-fijo-uva-pago-periodico/guardado/guardarPlazoFijoUvaPagoPeriodico.js'

export async function ejecutarPlazoFijoUvaPagoPeriodico() {
  try {
    const proveedores = await extraerPlazoFijoUvaPagoPeriodico()

    await guardarPlazoFijoUvaPagoPeriodico(proveedores)
  } catch (error) {
    console.error(
      'Error al extraer tasas de plazo fijo UVA con pago periódico',
      error,
    )
  }
}

export default ejecutarPlazoFijoUvaPagoPeriodico
