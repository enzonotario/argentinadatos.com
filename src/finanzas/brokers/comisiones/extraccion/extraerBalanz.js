import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  productosDesdeConcepto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const BALANZ_COMISIONES_URL = 'https://balanz.com/comisiones/'

const log = logGrupo({
  fuente: 'extraerBalanzComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * @param {string} concepto
 * @returns {'ARS'|'USD'|null}
 */
function monedaDesdeConcepto(concepto) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/dolar|usd|cable|mep/.test(t) && !/peso|ars/.test(t)) return 'USD'
  if (/peso|ars/.test(t) && !/dolar|usd/.test(t)) return 'ARS'
  if (/dolar|usd/.test(t)) return 'USD'
  if (/peso|ars/.test(t)) return 'ARS'
  return null
}

/**
 * @param {string} concepto
 * @returns {'compra'|'venta'|'ambas'|'colocadora'|'tomadora'}
 */
function operacionDesdeConcepto(concepto) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/caucion/.test(t)) return 'ambas'
  if (/^compra\b/.test(t) && !/venta/.test(t)) return 'compra'
  if (/^venta\b/.test(t) && !/compra/.test(t)) return 'venta'
  return 'ambas'
}

/**
 * Omite cargos fijos, rentas, transferencias y otros no comparables.
 * @param {string} concepto
 */
function esConceptoComparable(concepto) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/apertura|mantenimiento|sin cargo/.test(t)) return false
  if (/^renta\b|dividendos|amortizaci/.test(t)) return false
  if (/transferencia|conversion de adr|asesoramiento|arancel de exito/.test(t)) {
    return false
  }
  if (/bonificacion|mandato exterior/.test(t)) return false
  if (/suscripciones y rescates f\.?c\.?i/.test(t)) return false
  return productosDesdeConcepto(concepto).length > 0
}

/**
 * @param {string} html
 */
export function parsearBalanz(html) {
  const $ = load(html)
  /** @type {Array<object>} */
  const filas = []

  $('table tr').each((_, tr) => {
    const celdas = $(tr)
      .find('th,td')
      .map((__, c) => $(c).text().replace(/\s+/g, ' ').trim())
      .get()

    if (celdas.length < 2) return

    const concepto = celdas[0]
    if (!esConceptoComparable(concepto)) return

    const productos = productosDesdeConcepto(concepto)
    if (!productos.length) return

    const celda = celdas[1]
    const parsed = parseTasaComisionTexto(celda)
    if (parsed.tasa === null) return

    const moneda = monedaDesdeConcepto(concepto) ?? 'ARS'
    const operacion = operacionDesdeConcepto(concepto)
    const esCaucion = productos.includes('cauciones')

    for (const producto of productos) {
      filas.push(
        crearComisionBroker({
          entidad: 'balanz',
          nombreComercial: 'Balanz',
          producto,
          operacion,
          moneda,
          canal: 'web',
          plan: null,
          tasa: parsed.tasa,
          tasaBase: esCaucion ? 'anual' : parsed.tasaBaseHint,
          tasaEsTope: parsed.tasaEsTope || /hasta/i.test(celda),
          incluyeIva: false,
          ivaAdicional: parsed.ivaAdicional,
          prorrateoDias: esCaucion ? 90 : null,
          derechoMercado: null,
          enlace: BALANZ_COMISIONES_URL,
          metadata: {
            fuenteUrl: BALANZ_COMISIONES_URL,
            celdaOriginal: `${concepto} | ${celda}`,
            notas: esCaucion
              ? 'Tarifario unifica colocadora y tomadora. Tope con prorrata cada 90 días.'
              : productos.length > 1
                ? `Concepto unificado en tarifario; fila expandida a producto ${producto}.`
                : 'Canal trading online (retail).',
          },
        }),
      )
    }
  })

  return filas
}

export async function extraerBalanz() {
  try {
    const respuesta = await axios.get(BALANZ_COMISIONES_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    const comisiones = parsearBalanz(String(respuesta.data))
    logMensaje(log, 'Balanz parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
