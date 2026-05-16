import { load } from 'cheerio'
import { format, parse } from 'date-fns'
import { extraerBcraApi } from '@/extractores/bcra.extractor.js'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerIndiceUVA',
  tipo: 'extraccion',
})

export async function extraerIndiceUVA(desde, hasta) {
  try {
    const data = await extraerBcraApi(31, desde, hasta)

    return data.map(item => ({
      fecha: item.fecha,
      valor: item.value,
    }))
  } catch (error) {
    logError(log, error)
    throw error
  }
}
