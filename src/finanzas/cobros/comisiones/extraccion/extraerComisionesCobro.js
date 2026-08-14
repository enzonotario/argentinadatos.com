import { extraerGetnet } from './extraerGetnet.js'
import { extraerMercadoPago } from './extraerMercadoPago.js'
import { extraerUala } from './extraerUala.js'
import { extraerPayway } from './extraerPayway.js'
import { extraerProvincia } from './extraerProvincia.js'
import { extraerFiserv } from './extraerFiserv.js'
import { extraerNave } from './extraerNave.js'
import { extraerOpenpay } from './extraerOpenpay.js'
import { extraerViumi } from './extraerViumi.js'
import { extraerMaspagos } from './extraerMaspagos.js'
import { extraerNaranjaX } from './extraerNaranjaX.js'
import { extraerBezza } from './extraerBezza.js'
import { extraerSipago } from './extraerSipago.js'
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
      extraerPayway(),
      extraerProvincia(),
      extraerFiserv(),
      extraerNave(),
      extraerOpenpay(),
      extraerViumi(),
      extraerMaspagos(),
      extraerNaranjaX(),
      extraerBezza(),
      extraerSipago(),
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
