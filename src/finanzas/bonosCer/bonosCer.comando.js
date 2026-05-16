import { extraerBonosCer } from '@/finanzas/bonosCer/extraccion/extraerBonosCer.js'
import { guardarBonosCer } from '@/finanzas/bonosCer/guardado/guardarBonosCer.js'

export async function ejecutarBonosCer() {
  try {
    const datos = await extraerBonosCer()
    await guardarBonosCer(datos)
  } catch (error) {
    console.error('Error al extraer bonos CER', error)
  }
}

export default ejecutarBonosCer
