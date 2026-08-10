import { extraerPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerPrestamosPersonales.js'
import { guardarPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/guardado/guardarPrestamosPersonales.js'

export async function ejecutarPrestamosPersonales() {
  try {
    const datos = await extraerPrestamosPersonales()
    await guardarPrestamosPersonales(datos)
  } catch (error) {
    console.error('Error al extraer préstamos personales', error)
  }
}

export default ejecutarPrestamosPersonales
