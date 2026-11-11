import { logGrupo, logError, logMensaje } from '@/log.js'
import { extraerAdcapFal } from './extraerAdcapFal.js'
import { extraerBalanzFal } from './extraerBalanzFal.js'
import { extraerBnaFal } from './extraerBnaFal.js'
import { extraerBbvaFal } from './extraerBbvaFal.js'
import { extraerCocosFal } from './extraerCocosFal.js'
import { extraerGaliciaFal } from './extraerGaliciaFal.js'
import { extraerGstFal } from './extraerGstFal.js'
import { extraerIebFal } from './extraerIebFal.js'
import { extraerMacroFal } from './extraerMacroFal.js'
import { extraerMarivaFal } from './extraerMarivaFal.js'
import { extraerMaxFal } from './extraerMaxFal.js'
import { extraerSantanderFal } from './extraerSantanderFal.js'
import { extraerWiseFal } from './extraerWiseFal.js'

const log = logGrupo({
  fuente: 'extraerAlternativasFal',
  tipo: 'extraccion',
})

// IOL publica una guía y no un vehículo. BIND responde 403 y no hay texto que parsear.
const FUENTES = [
  { nombre: 'bbva', extraer: extraerBbvaFal },
  { nombre: 'wise-capital', extraer: extraerWiseFal },
  { nombre: 'santander', extraer: extraerSantanderFal },
  { nombre: 'balanz', extraer: extraerBalanzFal },
  { nombre: 'bna', extraer: extraerBnaFal },
  { nombre: 'macro', extraer: extraerMacroFal },
  { nombre: 'mariva', extraer: extraerMarivaFal },
  { nombre: 'ieb', extraer: extraerIebFal },
  { nombre: 'max-capital', extraer: extraerMaxFal },
  { nombre: 'cocos', extraer: extraerCocosFal },
  { nombre: 'galicia', extraer: extraerGaliciaFal },
  { nombre: 'gst', extraer: extraerGstFal },
  { nombre: 'adcap', extraer: extraerAdcapFal },
]

export async function extraerAlternativasFal() {
  const resultados = await Promise.allSettled(
    FUENTES.map(async fuente => {
      const filas = await fuente.extraer()
      return { nombre: fuente.nombre, filas }
    }),
  )

  /** @type {Array<object>} */
  const alternativas = []
  /** @type {Array<{ fuente: string, error: string }>} */
  const erroresExtraccion = []

  for (let i = 0; i < resultados.length; i++) {
    const resultado = resultados[i]
    const nombre = FUENTES[i].nombre

    if (resultado.status === 'rejected') {
      logError(log, resultado.reason)
      erroresExtraccion.push({
        fuente: nombre,
        error: resultado.reason?.message || String(resultado.reason),
      })
      continue
    }

    const filas = resultado.value.filas

    if (!Array.isArray(filas) || filas.length === 0) {
      erroresExtraccion.push({
        fuente: nombre,
        error: 'La página no publicó una alternativa reconocible',
      })
      continue
    }

    alternativas.push(...filas)
  }

  logMensaje(log, 'Alternativas FAL extraídas', {
    filas: alternativas.length,
    errores: erroresExtraccion.length,
  })

  const payload = {
    fechaActualizacion: new Date().toISOString(),
    alternativas,
  }

  if (erroresExtraccion.length) {
    payload.erroresExtraccion = erroresExtraccion
  }

  return payload
}
