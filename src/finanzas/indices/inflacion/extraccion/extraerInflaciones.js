import { load } from 'cheerio'
import { format, parse } from 'date-fns'
import { extraerBcraApi } from '@/finanzas/compartido/extraccion/bcra.js'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerInflaciones',
  tipo: 'extraccion',
})

export async function extraerInflaciones(desde, hasta) {
  try {
    const data = await extraerBcraApi(27, desde, hasta)

    return data.map(item => ({
      fecha: item.fecha,
      valor: item.valor,
    }))
  } catch (error) {
    logError(log, error)
    throw error
  }
}
