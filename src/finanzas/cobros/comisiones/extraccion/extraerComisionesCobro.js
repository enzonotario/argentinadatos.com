import { extraerGetnet } from './extraerGetnet.js'
import { extraerMercadoPago } from './extraerMercadoPago.js'
import { extraerUala } from './extraerUala.js'
import { extraerNaranjaX } from './extraerNaranjaX.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerComisionesCobro',
  tipo: 'extraccion',
})

export async function extraerComisionesCobro() {
  try {
    const resultados = await Promise.all([
      extraerGetnet(),
      extraerMercadoPago(),
      extraerUala(),
      extraerNaranjaX(),
    ])

    const comisiones = resultados.flat()

    logMensaje(log, 'Comisiones de cobro extraídas', {
      filas: comisiones.length,
    })

    return {
      fechaActualizacion: new Date().toISOString(),
      comisiones,
    }
  } catch (error) {
    logError(log, error)
    return {
      fechaActualizacion: new Date().toISOString(),
      comisiones: [],
      errorExtraccion: error.message,
    }
  }
}
