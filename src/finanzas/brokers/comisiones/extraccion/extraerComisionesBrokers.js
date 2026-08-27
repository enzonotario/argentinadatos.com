import { extraerIol } from './extraerIol.js'
import { extraerBalanz } from './extraerBalanz.js'
import { extraerBullMarket } from './extraerBullMarket.js'
import { extraerCocos } from './extraerCocos.js'
import { extraerPpi } from './extraerPpi.js'
import { extraerFiwind } from './extraerFiwind.js'
import { extraerIebMas } from './extraerIebMas.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerComisionesBrokers',
  tipo: 'extraccion',
})

const FUENTES = [
  { nombre: 'iol', extraer: extraerIol },
  { nombre: 'balanz', extraer: extraerBalanz },
  { nombre: 'bullmarket', extraer: extraerBullMarket },
  { nombre: 'cocos', extraer: extraerCocos },
  { nombre: 'ppi', extraer: extraerPpi },
  { nombre: 'fiwind', extraer: extraerFiwind },
  { nombre: 'iebmas', extraer: extraerIebMas },
]

export async function extraerComisionesBrokers() {
  const resultados = await Promise.allSettled(
    FUENTES.map(async (fuente) => {
      const filas = await fuente.extraer()
      return { nombre: fuente.nombre, filas }
    }),
  )

  /** @type {Array<object>} */
  const comisiones = []
  /** @type {Array<{ fuente: string, error: string }>} */
  const erroresExtraccion = []

  for (let i = 0; i < resultados.length; i++) {
    const resultado = resultados[i]
    const nombre = FUENTES[i].nombre

    if (resultado.status === 'fulfilled') {
      const filas = resultado.value.filas
      if (!Array.isArray(filas) || filas.length === 0) {
        logMensaje(log, 'Fuente sin filas', { fuente: nombre })
      } else {
        comisiones.push(...filas)
      }
      continue
    }

    logError(log, resultado.reason)
    erroresExtraccion.push({
      fuente: nombre,
      error: resultado.reason?.message || String(resultado.reason),
    })
  }

  logMensaje(log, 'Comisiones de brokers extraídas', {
    filas: comisiones.length,
    errores: erroresExtraccion.length,
  })

  const payload = {
    fechaActualizacion: new Date().toISOString(),
    comisiones,
  }

  if (erroresExtraccion.length) {
    payload.erroresExtraccion = erroresExtraccion
  }

  return payload
}
