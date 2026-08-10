import axios from 'axios'
import { logGrupo, logError } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const URL = 'https://www.santander.com.ar/personas/prestamos/personales'

const log = logGrupo({
  fuente: 'extraerSantanderPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} htmlOrText
 * @returns {Array<object>}
 */
export function parsearSantander(htmlOrText) {
  const texto = String(htmlOrText).replace(/\s+/g, ' ')

  const cftMatch = texto.match(/CFTEA:\s*([\d.,]+)\s*%/i)
  const tnaMatch = texto.match(
    /Tasa Fija Nominal Anual:\s*([\d.,]+)\s*%/i,
  )
  const teaMatch = texto.match(/Tasa Efectiva Anual:\s*([\d.,]+)\s*%/i)

  // Fallback ejemplo: "TNA del 79,00 % y CFTEA 150,86%"
  const tna =
    (tnaMatch ? parsePorcentaje(tnaMatch[1]) : null) ??
    (texto.match(/TNA del\s*([\d.,]+)\s*%/i)
      ? parsePorcentaje(texto.match(/TNA del\s*([\d.,]+)\s*%/i)[1])
      : null)

  const cftTea =
    (cftMatch ? parsePorcentaje(cftMatch[1]) : null) ??
    (texto.match(/CFTEA\s+([\d.,]+)\s*%/i)
      ? parsePorcentaje(texto.match(/CFTEA\s+([\d.,]+)\s*%/i)[1])
      : null)

  const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null

  if (tna === null && cftTea === null) {
    return []
  }

  return [
    {
      entidad: 'SANTANDER',
      nombreComercial: 'Santander',
      producto: 'Préstamo personal',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: false,
      condiciones: 'Cartera de consumo',
      enlace: URL,
      vigenciaDesde: null,
      vigenciaHasta: null,
      metadata: {},
    },
  ]
}

async function fetchHtmlAxios() {
  const respuesta = await axios.get(URL, {
    responseType: 'text',
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  return String(respuesta.data)
}

export async function extraerSantander() {
  try {
    let html = ''

    try {
      html = await fetchHtmlAxios()
    } catch (errorAxios) {
      logError(log, errorAxios)

      if (import.meta.env.VITE_FIRECRAWL_API_KEY) {
        const scraped = await scrapeHtmlWithFirecrawl(log, URL)
        html = scraped.html || scraped.markdown || ''
      } else {
        throw errorAxios
      }
    }

    return parsearSantander(html)
  } catch (error) {
    logError(log, error)
    return []
  }
}
