import { format } from 'date-fns'
import { extraerFiwind } from '@/finanzas/rendimientos/extraerFiwind.js'
import { leerRuta } from '@/utils/rutas.js'
import { extraerFiwindARSCondiciones } from './extraerFiwindARSCondiciones.js'
import { logGrupo, logError } from '@/log.js'

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

    var condiciones = null
    var condicionesCorto = null

    if (condicionesData) {
      condiciones = condicionesData.condiciones
      condicionesCorto = condicionesData.condicionesCorto
    } else {
      const historial = leerRuta('finanzas/fci/otros/fiwind')

      if (Array.isArray(historial)) {
        const ultimaConCondiciones = [...historial]
          .reverse()
          .find(e => e.condiciones !== null)

        if (ultimaConCondiciones) {
          condiciones = ultimaConCondiciones.condiciones
          condicionesCorto = ultimaConCondiciones.condicionesCorto
        }
      }
    }

    return {
      fondo: 'FIWIND',
      tna: Number((fiwindARS.bonusValue / 100).toFixed(4)),
      tea: Number(
        ((1 + fiwindARS.bonusValue / 100 / 365) ** 365 - 1).toFixed(4),
      ),
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
