import { extraerPresidentes } from '@/presidentes/extraccion/extraerPresidentes.js'
import { guardarPresidentes } from '@/presidentes/guardado/guardarPresidentes.js'

export default async function () {
  const presidentes = await extraerPresidentes()

  if (!presidentes || !presidentes.length) {
    console.error('No se encontraron presidentes')
    return
  }

  await guardarPresidentes(presidentes)
}
