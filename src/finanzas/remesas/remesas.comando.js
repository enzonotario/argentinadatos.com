import { extraerRemesas } from '@/finanzas/remesas/extraccion/extraerRemesas.js'
import { guardarRemesas } from '@/finanzas/remesas/guardado/guardarRemesas.js'

export async function ejecutarRemesas() {
  try {
    const datos = await extraerRemesas()
    await guardarRemesas(datos)
  } catch (error) {
    console.error('Error al extraer remesas', error)
  }
}

export default ejecutarRemesas
