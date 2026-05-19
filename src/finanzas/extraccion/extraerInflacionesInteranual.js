import { load } from 'cheerio'
import { format, parse } from 'date-fns'
import { extraerBcraApi } from '@/extractores/bcra.extractor.js'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerInflacionesInteranual',
  tipo: 'extraccion',
})

export async function extraerInflacionesInteranual(desde, hasta) {
  try {
    const data = await extraerBcraApi(28, desde, hasta)

    return data.map(item => ({
      fecha: item.fecha,
      valor: item.valor,
    }))
  } catch (error) {
    logError(log, error)
    throw error
  }
}
