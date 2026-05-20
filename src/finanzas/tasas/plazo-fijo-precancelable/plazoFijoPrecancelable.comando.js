import { extraerPlazoFijoPrecancelable } from '@/finanzas/tasas/plazo-fijo-precancelable/extraccion/extraerPlazoFijoPrecancelable.js'
import { guardarPlazoFijoPrecancelable } from '@/finanzas/tasas/plazo-fijo-precancelable/guardado/guardarPlazoFijoPrecancelable.js'

export async function ejecutarPlazoFijoPrecancelable() {
  try {
    const proveedores = await extraerPlazoFijoPrecancelable()

    await guardarPlazoFijoPrecancelable(proveedores)
  } catch (error) {
    console.error('Error al extraer plazo fijo precancelable', error)
  }
}

export default ejecutarPlazoFijoPrecancelable
