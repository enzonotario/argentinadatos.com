import { extraerPlazoFijoUvaPagoPeriodico } from '@/finanzas/extraccion/extraerPlazoFijoUvaPagoPeriodico.js'
import { guardarPlazoFijoUvaPagoPeriodico } from '@/finanzas/guardado/guardarPlazoFijoUvaPagoPeriodico.js'

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
