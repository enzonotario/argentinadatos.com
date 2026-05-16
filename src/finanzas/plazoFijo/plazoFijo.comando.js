import { extraerPlazoFijo } from '@/finanzas/extraccion/extraerPlazoFijo.js'
import { guardarPlazoFijo } from '@/finanzas/guardado/guardarPlazoFijo.js'

export async function ejecutarPlazoFijo() {
  try {
    const tasas = await extraerPlazoFijo()

    await guardarPlazoFijo(tasas)
  } catch (error) {
    console.error('Error al extraer tasas de plazo fijo', error)
  }
}

export default ejecutarPlazoFijo
