import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
  productosDesdeConcepto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const PPI_COMISIONES_URL =
  'https://www.portfoliopersonal.com/Contenido/comisiones'

const log = logGrupo({
  fuente: 'extraerPpiComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * @param {string} concepto
 * @returns {{ operacion: string, moneda: string, productos: string[] }|null}
 */
function clasificarConcepto(concepto) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  const productos = productosDesdeConcepto(concepto)
  if (!productos.length) return null

  // Niche / no retail Internet comparable
  if (/sin cotizacion|circ\.?\s*3368/.test(t)) return null
  if (/prestamos?\s+para\s+venta\s+en\s+corto/.test(t)) return null

  let operacion = 'ambas'
  if (/caucion|alquiler|prestamo|pase/.test(t)) {
    if (/tomadora|tomador/.test(t)) operacion = 'tomadora'
    else if (/colocadora|colocador/.test(t)) operacion = 'colocadora'
    else operacion = 'ambas'
  } else if (/^compra\b/.test(t) && !/venta/.test(t)) {
    operacion = 'compra'
  } else if (/^venta\b/.test(t) && !/compra/.test(t)) {
    operacion = 'venta'
  } else if (/ejercicio/.test(t)) {
    operacion = 'ambas'
  }

  let moneda = 'ARS'
  if (/dolar|usd/.test(t) && !/peso/.test(t)) moneda = 'USD'
  else if (/peso/.test(t) && !/dolar|usd/.test(t)) moneda = 'ARS'
  else if (/dolar|usd/.test(t)) moneda = 'USD'

  return { operacion, moneda, productos }
}

/**
 * Columna Internet (retail). Omite ND.
 * @param {string} html
 */
export function parsearPpi(html) {
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
    const clase = clasificarConcepto(concepto)
    if (!clase) return

    const celdaInternet = celdas[1]
    if (/^nd$/i.test(celdaInternet) || !celdaInternet) return

    const parsed = parseTasaComisionTexto(celdaInternet)
    if (parsed.tasa === null) return

    const minimoCelda = celdas[3] || ''
    const comisionMinima = parseComisionMinimaTexto(minimoCelda)

    let tasaBase = parsed.tasaBaseHint
    if (
      !tasaBase &&
      clase.productos.includes('cauciones') &&
      /anual/i.test(celdaInternet)
    ) {
      tasaBase = 'anual'
    }

    const exterior = /exterior|etfs? del exterior|fci exterior/i.test(concepto)

    for (const producto of clase.productos) {
      filas.push(
        crearComisionBroker({
          entidad: 'ppi',
          nombreComercial: 'Portfolio Personal Inversiones',
          producto,
          operacion: clase.operacion,
          moneda: clase.moneda,
          canal: 'web',
          plan: null,
          tasa: parsed.tasa,
          tasaBase,
          tasaEsTope: parsed.tasaEsTope,
          incluyeIva: false,
          ivaAdicional: parsed.ivaAdicional || /IVA/i.test(celdaInternet),
          prorrateoDias: null,
          comisionMinima,
          derechoMercado: null,
          enlace: PPI_COMISIONES_URL,
          metadata: {
            fuenteUrl: PPI_COMISIONES_URL,
            celdaOriginal: `${concepto} | Internet: ${celdaInternet}`,
            notas:
              clase.productos.length > 1
                ? `Columna Internet (retail). Concepto unificado; fila expandida a ${producto}.`
                : 'Columna Internet (retail). Filas ND omitidas. Máximos de asesor no incluidos.',
            ...(exterior ? { mercado: 'exterior' } : {}),
          },
        }),
      )
    }
  })

  return filas
}

export async function extraerPpi() {
  try {
    const respuesta = await axios.get(PPI_COMISIONES_URL, {
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

    const comisiones = parsearPpi(String(respuesta.data))
    logMensaje(log, 'PPI parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
