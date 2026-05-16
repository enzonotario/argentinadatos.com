import { extraerRem } from './extraccion/extraerRem.js'
import { guardarRem } from './guardado/guardarRem.js'

export async function ejecutarRem() {
  const datos = await extraerRem()
  await guardarRem(datos)
  return datos
}

export default ejecutarRem
