import { format } from 'date-fns'
import { extraerFiwind } from '@/finanzas/rendimientos/extraerFiwind.js'
import { leerRuta } from '@/utils/rutas.js'
import { extraerFiwindARSCondiciones } from './extraerFiwindARSCondiciones.js'
import { logGrupo, logError } from '@/log.js'
import {
  calcularTeaDesdeTna,
  porcentajeADecimal,
} from '@/finanzas/compartido/utils/tasas.js'

const log = logGrupo({
  fuente: 'extraerFiwindARS',
  tipo: 'extraccion',
})

export async function extraerFiwindARS() {
  try {
    const rendimientos = await extraerFiwind()
    const fiwindARS = rendimientos.find(
      item => item.moneda === 'ARS' && item.apy > 0,
    )

    if (!fiwindARS) {
      return null
    }

    const condicionesData = await extraerFiwindARSCondiciones()
    let condiciones = null
    let condicionesCorto = null

    if (condicionesData) {
      condiciones = condicionesData.condiciones
      condicionesCorto = condicionesData.condicionesCorto
    } else {
      const historial = leerRuta('finanzas/fci/otros/fiwind')

      if (Array.isArray(historial)) {
        const ultimaConCondiciones = [...historial]
          .reverse()
          .find(item => item.condiciones !== null)

        if (ultimaConCondiciones) {
          condiciones = ultimaConCondiciones.condiciones
          condicionesCorto = ultimaConCondiciones.condicionesCorto
        }
      }
    }

    const tna = porcentajeADecimal(fiwindARS.bonusValue)

    return {
      fondo: 'FIWIND',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: fiwindARS.bonusThreshold,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones,
      condicionesCorto,
    }
  } catch (error) {
    logError(log, error)
    return null
  }
}
