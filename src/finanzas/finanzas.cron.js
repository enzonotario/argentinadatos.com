import { extraerInflaciones } from '@/finanzas/indices/inflacion/extraccion/extraerInflaciones.js'
import { guardarInflaciones } from '@/finanzas/indices/inflacion/guardado/guardarInflaciones.js'
import { extraerInflacionesInteranual } from '@/finanzas/indices/inflacion-interanual/extraccion/extraerInflacionesInteranual.js'
import { guardarInflacionesInteranual } from '@/finanzas/indices/inflacion-interanual/guardado/guardarInflacionesInteranual.js'
import { extraerPlazoFijo } from '@/finanzas/tasas/plazo-fijo/extraccion/extraerPlazoFijo.js'
import { guardarPlazoFijo } from '@/finanzas/tasas/plazo-fijo/guardado/guardarPlazoFijo.js'
import { extraerPlazoFijoUvaPagoPeriodico } from '@/finanzas/tasas/plazo-fijo-uva-pago-periodico/extraccion/extraerPlazoFijoUvaPagoPeriodico.js'
import { guardarPlazoFijoUvaPagoPeriodico } from '@/finanzas/tasas/plazo-fijo-uva-pago-periodico/guardado/guardarPlazoFijoUvaPagoPeriodico.js'
import { extraerPlazoFijoPrecancelable } from '@/finanzas/tasas/plazo-fijo-precancelable/extraccion/extraerPlazoFijoPrecancelable.js'
import { guardarPlazoFijoPrecancelable } from '@/finanzas/tasas/plazo-fijo-precancelable/guardado/guardarPlazoFijoPrecancelable.js'
import { extraerTasasDepositos30Dias } from '@/finanzas/tasas/depositos-30-dias/extraccion/extraerTasasDepositos30Dias.js'
import { guardarTasasDepositos30Dias } from '@/finanzas/tasas/depositos-30-dias/guardado/guardarTasasDepositos30Dias.js'
import { extraerIndiceUVA } from '@/finanzas/indices/uva/extraccion/extraerIndiceUVA.js'
import { guardarIndiceUVA } from '@/finanzas/indices/uva/guardado/guardarIndiceUVA.js'
import fci from '@/finanzas/fci/fci.comando.js'
import rendimientos from '@/finanzas/rendimientos/rendimientos.comando.js'
import riesgoPais from '@/finanzas/indices/riesgo-pais/riesgoPais.comando.js'
import { ejecutarCriptopesos } from '@/finanzas/criptopesos/criptopesos.comando.js'
import { extraerCreditosHipotecariosUva } from '@/finanzas/creditos/hipotecarios-uva/extraccion/extraerCreditosHipotecariosUva.js'
import { guardarCreditosHipotecariosUva } from '@/finanzas/creditos/hipotecarios-uva/guardado/guardarCreditosHipotecariosUva.js'
import { extraerInflacionREM } from '@/finanzas/inflacion/rem/extraccion/extraerInflacionREM.js'
import { guardarInflacionREM } from '@/finanzas/inflacion/rem/guardado/guardarInflacionREM.js'
import remComando from '@/finanzas/rem/rem.comando.js'
import letrasComando from '@/finanzas/letras/letras.comando.js'
import ejecutarBonosCer from '@/finanzas/bonos-cer/bonosCer.comando.js'
import { subMonths, addMonths, format, subDays, addDays } from 'date-fns'

export async function cronFinanzas() {
  await inflacionMensual()
  await inflacionInteranual()
  await plazoFijo()
  await plazoFijoUvaPagoPeriodico()
  await plazoFijoPrecancelable()
  await tasasDepositos30Dias()
  await indiceUVA()
  await fci()
  await rendimientos()
  await riesgoPais()
  await ejecutarCriptopesos()
  await creditosHipotecariosUva()
  await inflacionREM()
  await rem()
  await letras()
  await ejecutarBonosCer()
}

async function inflacionMensual() {
  try {
    const hoy = new Date()

    const inflaciones = await extraerInflaciones(
      format(subMonths(hoy, 3), 'yyyy-MM-dd'),
      format(addMonths(hoy, 3), 'yyyy-MM-dd'),
    )

    await guardarInflaciones(inflaciones)
  } catch (error) {
    console.error('Error al extraer inflaciones mensuales', error)
  }
}

async function inflacionInteranual() {
  try {
    const hoy = new Date()

    const inflaciones = await extraerInflacionesInteranual(
      format(subMonths(hoy, 3), 'yyyy-MM-dd'),
      format(addMonths(hoy, 3), 'yyyy-MM-dd'),
    )

    await guardarInflacionesInteranual(inflaciones)
  } catch (error) {
    console.error('Error al extraer inflaciones interanuales', error)
  }
}

async function plazoFijo() {
  try {
    const tasas = await extraerPlazoFijo()

    await guardarPlazoFijo(tasas)
  } catch (error) {
    console.error('Error al extraer tasas de plazo fijo', error)
  }
}

async function plazoFijoUvaPagoPeriodico() {
  try {
    const proveedores = await extraerPlazoFijoUvaPagoPeriodico()

    await guardarPlazoFijoUvaPagoPeriodico(proveedores)
  } catch (error) {
    console.error(
      'Error al extraer tasas de plazo fijo UVA con pago periódico',
      error,
    )
  }
}

async function plazoFijoPrecancelable() {
  try {
    const proveedores = await extraerPlazoFijoPrecancelable()

    await guardarPlazoFijoPrecancelable(proveedores)
  } catch (error) {
    console.error('Error al extraer plazo fijo precancelable', error)
  }
}

async function tasasDepositos30Dias() {
  try {
    const hoy = new Date()

    const tasas = await extraerTasasDepositos30Dias(
      format(subDays(hoy, 7), 'yyyy-MM-dd'),
      format(addDays(hoy, 1), 'yyyy-MM-dd'),
    )

    await guardarTasasDepositos30Dias(tasas)
  } catch (error) {
    console.error('Error al extraer tasas de depositos a 30 dias', error)
  }
}

async function indiceUVA() {
  try {
    const hoy = new Date()

    const indices = await extraerIndiceUVA(
      format(subDays(hoy, 7), 'yyyy-MM-dd'),
      format(addDays(hoy, 1), 'yyyy-MM-dd'),
    )

    await guardarIndiceUVA(indices)
  } catch (error) {
    console.error('Error al extraer indice UVA', error)
  }
}

async function creditosHipotecariosUva() {
  try {
    const datos = await extraerCreditosHipotecariosUva()

    await guardarCreditosHipotecariosUva(datos)
  } catch (error) {
    console.error('Error al extraer créditos hipotecarios UVA', error)
  }
}

async function inflacionREM() {
  try {
    const datos = await extraerInflacionREM()

    await guardarInflacionREM(datos)
  } catch (error) {
    console.error('Error al extraer inflación REM', error)
  }
}

async function rem() {
  try {
    await remComando()
  } catch (error) {
    console.error('Error al extraer REM', error)
  }
}

async function letras() {
  try {
    await letrasComando()
  } catch (error) {
    console.error('Error al extraer letras', error)
  }
}
