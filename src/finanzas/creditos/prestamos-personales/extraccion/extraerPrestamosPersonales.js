import { extraerBna } from './extraerBna.js'
import { extraerBbva } from './extraerBbva.js'
import { extraerSupervielle } from './extraerSupervielle.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPrestamosPersonales',
  tipo: 'extraccion',
})

export async function extraerPrestamosPersonales() {
  try {
    const resultados = await Promise.all([
      extraerBna(),
      extraerBbva(),
      extraerSupervielle(),
    ])

    return resultados.flat()
  } catch (error) {
    logError(log, error)
    return []
  }
}
