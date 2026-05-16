import { extraerInflaciones } from '@/finanzas/extraccion/extraerInflaciones.js'
import { guardarInflaciones } from '@/finanzas/guardado/guardarInflaciones.js'
import { extraerInflacionesInteranual } from '@/finanzas/extraccion/extraerInflacionesInteranual.js'
import { guardarInflacionesInteranual } from '@/finanzas/guardado/guardarInflacionesInteranual.js'
import { extraerPlazoFijo } from '@/finanzas/extraccion/extraerPlazoFijo.js'
import { guardarPlazoFijo } from '@/finanzas/guardado/guardarPlazoFijo.js'
import { extraerPlazoFijoUvaPagoPeriodico } from '@/finanzas/extraccion/extraerPlazoFijoUvaPagoPeriodico.js'
import { guardarPlazoFijoUvaPagoPeriodico } from '@/finanzas/guardado/guardarPlazoFijoUvaPagoPeriodico.js'
import { extraerPlazoFijoPrecancelable } from '@/finanzas/extraccion/extraerPlazoFijoPrecancelable.js'
import { guardarPlazoFijoPrecancelable } from '@/finanzas/guardado/guardarPlazoFijoPrecancelable.js'
import { extraerTasasDepositos30Dias } from '@/finanzas/extraccion/extraerTasasDepositos30Dias.js'
import { guardarTasasDepositos30Dias } from '@/finanzas/guardado/guardarTasasDepositos30Dias.js'
import { extraerIndiceUVA } from '@/finanzas/extraccion/extraerIndiceUVA.js'
import { guardarIndiceUVA } from '@/finanzas/guardado/guardarIndiceUVA.js'
import fci from '@/finanzas/fci/fci.comando.js'
import rendimientos from '@/finanzas/rendimientos/rendimientos.comando.js'
import riesgoPais from '@/finanzas/riesgoPais/riesgoPais.comando.js'
import { ejecutarCriptopesos } from '@/finanzas/criptopesos/criptopesos.comando.js'
import { extraerCreditosHipotecariosUva } from '@/finanzas/creditosHipotecariosUva/extraccion/extraerCreditosHipotecariosUva.js'
import { guardarCreditosHipotecariosUva } from '@/finanzas/creditosHipotecariosUva/guardado/guardarCreditosHipotecariosUva.js'
import { extraerInflacionREM } from '@/finanzas/inflacionREM/extraccion/extraerInflacionREM.js'
import { guardarInflacionREM } from '@/finanzas/inflacionREM/guardado/guardarInflacionREM.js'
import remComando from '@/finanzas/rem/rem.comando.js'
import letrasComando from '@/finanzas/letras/letras.comando.js'
import ejecutarBonosCer from '@/finanzas/bonosCer/bonosCer.comando.js'
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
