import { extraerBancor } from './extraerBancor.js'
import { extraerBbva } from './extraerBbva.js'
import { extraerBna } from './extraerBna.js'
import { extraerChubut } from './extraerChubut.js'
import { extraerCiudad } from './extraerCiudad.js'
import { extraerGalicia } from './extraerGalicia.js'
import { extraerHipotecario } from './extraerHipotecario.js'
import { extraerMacro } from './extraerMacro.js'
import { extraerPatagonia } from './extraerPatagonia.js'
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
      extraerBna(),
      extraerChubut(),
      extraerCiudad(),
      extraerGalicia(),
      extraerHipotecario(),
      extraerMacro(),
      extraerPatagonia(),
      extraerSantander(),
    ])

    return resultados.flat()
  } catch (error) {
    logError(log, error)
    return []
  }
}
