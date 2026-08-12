import { extraerComisionesCobro } from '@/finanzas/cobros/comisiones/extraccion/extraerComisionesCobro.js'
import { guardarComisionesCobro } from '@/finanzas/cobros/comisiones/guardado/guardarComisionesCobro.js'

export async function ejecutarComisionesCobro() {
  try {
    const datos = await extraerComisionesCobro()
    await guardarComisionesCobro(datos)
  } catch (error) {
    console.error('Error al extraer comisiones de cobro', error)
  }
}

export default ejecutarComisionesCobro
