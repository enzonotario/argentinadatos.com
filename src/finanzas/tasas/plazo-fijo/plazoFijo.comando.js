import { extraerPlazoFijo } from '@/finanzas/tasas/plazo-fijo/extraccion/extraerPlazoFijo.js'
import { guardarPlazoFijo } from '@/finanzas/tasas/plazo-fijo/guardado/guardarPlazoFijo.js'

export async function ejecutarPlazoFijo() {
  try {
    const tasas = await extraerPlazoFijo()

    await guardarPlazoFijo(tasas)
  } catch (error) {
    console.error('Error al extraer tasas de plazo fijo', error)
  }
}

export default ejecutarPlazoFijo
