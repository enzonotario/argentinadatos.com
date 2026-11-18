import axios from 'axios'
import { load } from 'cheerio'
import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  calcularTeaDesdeTna,
  porcentajeADecimal,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

const URL_BRUBANK_TASAS =
  'https://help.brubank.com/es/articles/10508364-tasas-de-interes-vigentes'

const FONDOS_POR_CARTERA = {
  general: 'BRUBANK CUENTA MAX',
  seleccionada: 'BRUBANK CUENTA MAX SELECCIONADA',
}

function formatearMonto(monto) {
  return `$${monto.toLocaleString('es-AR')}`
}

function construirCondiciones(cartera, tope) {
  const topeTexto = tope ? ` hasta ${formatearMonto(tope)}` : ''

  if (cartera === 'seleccionada') {
    return {
      condiciones: `Tasa de Cuenta Max de Brubank para la cartera seleccionada por el banco. Remunera${topeTexto}.`,
      condicionesCorto: `Cuenta Max, solo cartera seleccionada${topeTexto}`,
    }
  }

  return {
    condiciones: `Tasa de Cuenta Max de Brubank para la cartera general. Remunera${topeTexto}.`,
    condicionesCorto: `Cuenta Max${topeTexto}`,
  }
}

export function parsearTasasCuentaMaxBrubank(html) {
  const $ = load(html)
  const texto = $('body').text().replace(/\s+/g, ' ')
  const patron =
    /hasta\s+\$\s*([\d.]+)\s+para\s+cartera\s+(general|seleccionada)\.?\s*TNA\s*(\d+(?:[.,]\d+)?)\s*%/gi

  const tramos = [...texto.matchAll(patron)].map(coincidencia => {
    const cartera = coincidencia[2].toLowerCase()
    const tope = Number(coincidencia[1].replace(/\./g, ''))
    const tna = redondearTasa(
      porcentajeADecimal(Number(coincidencia[3].replace(',', '.'))),
    )

    return {
      fondo: FONDOS_POR_CARTERA[cartera],
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: tope > 0 ? tope : null,
      ...construirCondiciones(cartera, tope),
    }
  })

  if (!tramos.some(tramo => tramo.fondo === FONDOS_POR_CARTERA.general)) {
    throw new Error('No se encontró la TNA de cartera general de Brubank')
  }

  return tramos
}

export async function extraerBrubankCuentaMax() {
  const log = logGrupo({
    fuente: 'extraerBrubank',
    tipo: 'cuentaRemunerada',
  })

  try {
    const respuesta = await axios.get(URL_BRUBANK_TASAS, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const tramos = parsearTasasCuentaMaxBrubank(respuesta.data)
    const fecha = format(new Date(), 'yyyy-MM-dd')

    logMensaje(log, 'Extracción de Brubank exitosa', {
      tramos: tramos.length,
    })

    return tramos.map(tramo => ({ ...tramo, fecha }))
  } catch (error) {
    logError(log, error)
    return []
  }
}
