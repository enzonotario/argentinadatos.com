import { extraerBancor } from './extraerBancor.js'
import { extraerBbva } from './extraerBbva.js'
import { extraerMacro } from './extraerMacro.js'
import { extraerSantander } from './extraerSantander.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPrestamosPersonales',
  tipo: 'extraccion',
})

export async function extraerPrestamosPersonales() {
  try {
    const resultados = await Promise.all([
      extraerBancor(),
      extraerBbva(),
      extraerMacro(),
      extraerSantander(),
    ])

    return resultados.flat()
  } catch (error) {
    logError(log, error)
    return []
  }
}
