import { extraerBcraApi } from '@/finanzas/compartido/extraccion/bcra.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerTasasDepositos30Dias',
  tipo: 'extraccion',
})

export async function extraerTasasDepositos30Dias(desde, hasta) {
  try {
    const data = await extraerBcraApi(12, desde, hasta)

    return data.map(item => ({
      fecha: item.fecha,
      valor: porcentajeADecimal(item.valor),
    }))
  } catch (error) {
    logError(log, error)
    throw error
  }
}
