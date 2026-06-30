import { format } from 'date-fns'
import { extraerNaranjaX } from '@/finanzas/fci/otros/extraccion/extraerNaranjaX.js'
import { extraerSupervielleCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerSupervielle.js'
import { extraerSupervielleHitIolCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerSupervielleHitIol.js'
import { extraerBnaCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerBna.js'
import { extraerCresiumCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerCresium.js'
import { extraerFiwindARS } from '@/finanzas/fci/otros/extraccion/extraerFiwindARS.js'
import { extraerCarrefourCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerCarrefour.js'
import { extraerMontemarPayCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerMontemarPay.js'
import { extraerBeloCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerBelo.js'
import { extraerVoiiCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerVoii.js'
import { extraerBicaCuentaPositiva } from '@/finanzas/fci/otros/extraccion/extraerBica.js'
import { guardarSerieOtros } from '@/finanzas/fci/otros/guardado/guardarSerieOtros.js'
import { logGrupo, logMensaje, logError } from '@/log.js'

const log = logGrupo({
  comando: 'finanzas.fci.otros',
})

export async function extraerSerieOtros() {
  try {
    const resultados = [
      await extraerNaranjaX(),
      await extraerFiwindARS(),
      await extraerCarrefourCuentaRemunerada(),
      await extraerMontemarPayCuentaRemunerada(),
      await extraerCresiumCuentaRemunerada(),
      await extraerBeloCuentaRemunerada(),
      await extraerVoiiCuentaRemunerada(),
      ...(await extraerBicaCuentaPositiva()),
    ]

    const valoresExtraidos = resultados.filter(item => item.fondo)
    const sinFondo = resultados.length - valoresExtraidos.length

    if (sinFondo > 0) {
      logMensaje(log, 'Se descartaron extracciones sin fondo en FCI otros', {
        totalFuentes: resultados.length,
        descartados: sinFondo,
      })
    }

    if (valoresExtraidos.length === 0) {
      logMensaje(log, 'No se obtuvieron valores válidos en FCI otros')
      return
    }

    const fechaActual = format(new Date(), 'yyyy-MM-dd')

    const valoresConFecha = valoresExtraidos.map(item => ({
      ...item,
      fecha: item.fecha || fechaActual,
    }))

    log.info('[/v1/finanzas/fci/otros]: Valores extraídos', valoresConFecha)
    console.log('[/v1/finanzas/fci/otros]: Valores extraídos', valoresConFecha)

    await guardarSerieOtros(valoresConFecha)
  } catch (error) {
    logError(log, error)
  }
}

export async function extraerSerieOtrosIA() {
  try {
    const resultados = [
      await extraerSupervielleCuentaRemunerada(),
      await extraerSupervielleHitIolCuentaRemunerada(),
      await extraerBnaCuentaRemunerada(),
    ]

    const valoresExtraidos = resultados.filter(item => item.fondo)
    const sinFondo = resultados.length - valoresExtraidos.length

    if (sinFondo > 0) {
      logMensaje(log, 'Se descartaron extracciones sin fondo en FCI otros IA', {
        totalFuentes: resultados.length,
        descartados: sinFondo,
      })
    }

    if (valoresExtraidos.length === 0) {
      logMensaje(log, 'No se obtuvieron valores válidos en FCI otros IA')
      return
    }

    const fechaActual = format(new Date(), 'yyyy-MM-dd')

    const valoresConFecha = valoresExtraidos.map(item => ({
      ...item,
      fecha: item.fecha || fechaActual,
    }))

    log.info('[/v1/finanzas/fci/otros]: Valores extraídos IA', valoresConFecha)
    console.log(
      '[/v1/finanzas/fci/otros]: Valores extraídos IA',
      valoresConFecha,
    )

    await guardarSerieOtros(valoresConFecha)
  } catch (error) {
    logError(log, error)
  }
}
