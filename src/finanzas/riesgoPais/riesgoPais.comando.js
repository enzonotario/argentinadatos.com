import { format, subDays, addDays, isBefore as esAntes, parse } from 'date-fns'
import { escribirRuta, leerRuta } from '@/utils/rutas.js'
import { extraerRiesgoPais } from '@/finanzas/riesgoPais/extraerRiesgoPais.js'
import collect from 'collect.js'

export default async function () {
  const valoresExtraidos = collect(
    await extraerRiesgoPais(subDays(new Date(), 10), new Date()),
  )
    .sortBy('fecha')
    .toArray()

  const ultimoValor = valoresExtraidos[valoresExtraidos.length - 1]

  const rutasGuardadas = [
    await guardarUltimo(ultimoValor),
    await guardarHistorico(valoresExtraidos),
  ]

  return rutasGuardadas
}

async function guardarUltimo(ultimoRiesgoPais, fecha) {
  const ruta = '/finanzas/indices/riesgo-pais/ultimo'

  await escribirRuta(ruta, ultimoRiesgoPais)

  return ruta
}

async function guardarHistorico(valores) {
  const ruta = '/finanzas/indices/riesgo-pais'

  const historico = await leerRuta(ruta)

  const nuevoHistorico = collect(
    historico.map(item => {
      const nuevoValor = valores.find(v => v.fecha === item.fecha)

      if (nuevoValor) {
        return {
          valor: nuevoValor.valor,
          fecha: item.fecha,
        }
      }

      return item
    }),
  )
    .merge(valores.filter(v => !historico.some(h => h.fecha === v.fecha)))
    .sortBy('fecha')
    .toArray()

  await escribirRuta(ruta, nuevoHistorico)

  return ruta
}
