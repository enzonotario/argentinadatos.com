import { extraerBonosCer } from '@/finanzas/bonos-cer/extraccion/extraerBonosCer.js'
import { guardarBonosCer } from '@/finanzas/bonos-cer/guardado/guardarBonosCer.js'

export async function ejecutarBonosCer() {
  try {
    const datos = await extraerBonosCer()
    await guardarBonosCer(datos)
  } catch (error) {
    console.error('Error al extraer bonos CER', error)
  }
}

export default ejecutarBonosCer
