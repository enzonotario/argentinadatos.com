import { extraerGalicia } from './extraerGalicia.js'
import { extraerSupervielle } from './extraerSupervielle.js'
import { extraerBna } from './extraerBna.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerCuentasRemuneradasUsd',
  tipo: 'extraccion',
})

export async function extraerCuentasRemuneradasUsd() {
  try {
    const resultados = await Promise.all([
      extraerGalicia(),
      extraerSupervielle(),
      extraerBna(),
    ])

    return resultados.flat()
  } catch (error) {
    logError(log, error)
    return []
  }
}
