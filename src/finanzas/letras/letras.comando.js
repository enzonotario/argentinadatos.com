import { extraerLetras } from '@/finanzas/letras/extraccion/extraerLetras.js'
import { guardarLetras } from '@/finanzas/letras/guardado/guardarLetras.js'

export async function ejecutarLetras() {
  try {
    const datos = await extraerLetras()
    await guardarLetras(datos)
  } catch (error) {
    console.error('Error al extraer datos de LECAPs/BONCAPs', error)
  }
}

export default ejecutarLetras
