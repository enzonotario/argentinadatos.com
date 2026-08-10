import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const URL = 'https://www.mercadopago.com.ar/ayuda/18691'

const log = logGrupo({
  fuente: 'extraerMercadoPagoPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * Decodifica escapes unicode típicos del HTML embebido de Mercado Pago.
 * @param {string} html
 * @returns {string}
 */
export function normalizarHtmlMercadoPago(html) {
  return String(html)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
}

/**
 * @param {string} html
 * @param {string} label
 * @returns {{ tna: number, tea: number, cftTea: number } | null}
 */
function parsearFilaTasa(html, label) {
  const idx = html.indexOf(label)

  if (idx < 0) return null

  const chunk = html.slice(idx, idx + 1200)
  const tasas = [...chunk.matchAll(/(?<![\d.])(\d{1,4},\d{2})\s*%/g)].map(
    (m) => m[1],
  )

  if (tasas.length < 3) return null

  const tna = parsePorcentaje(tasas[0])
  const tea = parsePorcentaje(tasas[1])
  const cftTea = parsePorcentaje(tasas[2])

  if (tna === null || tea === null || cftTea === null) return null

  return { tna, tea, cftTea }
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearMercadoPago(html) {
  const texto = normalizarHtmlMercadoPago(html)
  const seccionPrestamos = texto.split(
    /Tasas Vigentes para Tarjeta de Cr[eé]dito/i,
  )[0]

  const plazoMinMatch = seccionPrestamos.match(
    /Plazo m[ií]nimo[\s\S]*?(\d+)\s*d[ií]as/i,
  )
  const plazoMaxMatch = seccionPrestamos.match(
    /Plazo m[aá]ximo[\s\S]*?(\d+)\s*meses/i,
  )

  const plazoMinDias = plazoMinMatch
    ? Number.parseInt(plazoMinMatch[1], 10)
    : null
  const plazoMaxMeses = plazoMaxMatch
    ? Number.parseInt(plazoMaxMatch[1], 10)
    : null

  const minima = parsearFilaTasa(seccionPrestamos, 'Tasa mínima')
  const maxima = parsearFilaTasa(seccionPrestamos, 'Tasa máxima')

  if (!minima) return []

  return [
    {
      entidad: 'MERCADOPAGO',
      nombreComercial: 'Mercado Pago',
      producto: 'Préstamo personal / Línea de consumo',
      // Tasas de referencia = mínimas del rango (según evaluación crediticia).
      tna: minima.tna,
      tea: minima.tea,
      cftTna: null,
      cftTea: minima.cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: true,
      condiciones: 'Rango según solicitud',
      enlace: URL,
      vigenciaDesde: null,
      vigenciaHasta: null,
      metadata: {
        ...(plazoMinDias != null ? { plazoMinDias } : {}),
        ...(plazoMaxMeses != null ? { plazoMaxMeses } : {}),
        rango: {
          tna: {
            min: minima.tna,
            max: maxima?.tna ?? null,
          },
          tea: {
            min: minima.tea,
            max: maxima?.tea ?? null,
          },
          cftTea: {
            min: minima.cftTea,
            max: maxima?.cftTea ?? null,
          },
        },
      },
    },
  ]
}

async function fetchHtml() {
  try {
    const respuesta = await axios.get(URL, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    const html = String(respuesta.data)

    if (/Tasa m[ií]nima/i.test(normalizarHtmlMercadoPago(html))) {
      return html
    }

    throw new Error('HTML de Mercado Pago sin tasas embebidas')
  } catch (errorAxios) {
    logMensaje(log, 'Axios Mercado Pago falló o sin tasas, pruebo Firecrawl', {
      errorMessage: errorAxios.message,
    })

    if (!import.meta.env.VITE_FIRECRAWL_API_KEY) {
      throw errorAxios
    }

    const scraped = await scrapeHtmlWithFirecrawl(log, URL)
    return scraped.html || scraped.markdown || ''
  }
}

export async function extraerMercadoPago() {
  try {
    const html = await fetchHtml()
    const ofertas = parsearMercadoPago(html)

    logMensaje(log, 'Mercado Pago parseado', { ofertas: ofertas.length })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
