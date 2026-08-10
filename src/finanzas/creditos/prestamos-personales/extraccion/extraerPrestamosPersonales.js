import { extraerBna } from './extraerBna.js'
import { extraerBnaNacionSueldos } from './extraerBnaNacionSueldos.js'
import { extraerBbva } from './extraerBbva.js'
import { extraerGalicia } from './extraerGalicia.js'
import { extraerMacro } from './extraerMacro.js'
import { extraerSantander } from './extraerSantander.js'
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
      extraerBnaNacionSueldos(),
      extraerBbva(),
      extraerGalicia(),
      extraerMacro(),
      extraerSantander(),
      extraerSupervielle(),
    ])

    return resultados.flat()
  } catch (error) {
    logError(log, error)
    return []
  }
}
