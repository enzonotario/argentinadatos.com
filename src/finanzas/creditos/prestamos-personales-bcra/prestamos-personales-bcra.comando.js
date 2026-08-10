import { extraerPrestamosPersonalesBcra } from '@/finanzas/creditos/prestamos-personales-bcra/extraccion/extraerPrestamosPersonalesBcra.js'
import { guardarPrestamosPersonalesBcra } from '@/finanzas/creditos/prestamos-personales-bcra/guardado/guardarPrestamosPersonalesBcra.js'

export async function ejecutarPrestamosPersonalesBcra() {
  try {
    const datos = await extraerPrestamosPersonalesBcra()
    await guardarPrestamosPersonalesBcra(datos)
  } catch (error) {
    console.error('Error al extraer préstamos personales BCRA', error)
  }
}

export default ejecutarPrestamosPersonalesBcra
