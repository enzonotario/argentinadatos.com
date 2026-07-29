import collect from 'collect.js'
import { escribirRuta } from '@/utils/rutas.js'
import { extraerConfianzaGobierno } from '@/politica/indices/confianza-gobierno/extraccion/extraerConfianzaGobierno.js'

export default async function () {
  const valores = collect(await extraerConfianzaGobierno())
    .sortBy('fecha')
    .toArray()

  if (!valores.length) {
    return []
  }

  const ultimo = valores[valores.length - 1]

  return [
    await guardarHistorico(valores),
    await guardarUltimo(ultimo),
  ]
}

async function guardarHistorico(valores) {
  const ruta = '/politica/indices/confianza-gobierno'
  await escribirRuta(ruta, valores)
  return ruta
}

async function guardarUltimo(ultimo) {
  const ruta = '/politica/indices/confianza-gobierno/ultimo'
  await escribirRuta(ruta, ultimo)
  return ruta
}
