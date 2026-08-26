import { extraerComisionesBrokers } from '@/finanzas/brokers/comisiones/extraccion/extraerComisionesBrokers.js'
import { guardarComisionesBrokers } from '@/finanzas/brokers/comisiones/guardado/guardarComisionesBrokers.js'

export async function ejecutarComisionesBrokers() {
  try {
    const datos = await extraerComisionesBrokers()
    await guardarComisionesBrokers(datos)
  } catch (error) {
    console.error('Error al extraer comisiones de brokers', error)
  }
}

export default ejecutarComisionesBrokers
