import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
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

  const cftMatch =
    texto.match(/CFTEA:\s*([\d.,]+)\s*%/i) ||
    texto.match(/C\.?F\.?T\.?E\.?A\.?[^0-9%]{0,20}([\d.,]+)\s*%/i)

  const tnaMatch =
    texto.match(/Tasa Fija Nominal Anual:\s*([\d.,]+)\s*%/i) ||
    texto.match(/TNA del\s*([\d.,]+)\s*%/i) ||
    texto.match(/\bTNA[:\s]+([\d.,]+)\s*%/i)

  const teaMatch =
    texto.match(/Tasa Efectiva Anual:\s*([\d.,]+)\s*%/i) ||
    texto.match(/(?<![A-Z])TEA:\s*([\d.,]+)\s*%/i)

  const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
  const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null
  const cftTea = cftMatch ? parsePorcentaje(cftMatch[1]) : null

  if (tna === null && cftTea === null) {
    return []
  }

  const plazoMaxMatch =
    texto.match(/Plazo m[aá]ximo[^0-9]{0,40}(\d+)\s*meses/i) ||
    texto.match(/plazo de\s+(\d+)\s*meses/i)
  const plazoMinMatch =
    texto.match(/m[ií]nimo:\s*(\d+)\s*meses/i) ||
    texto.match(/Plazo m[ií]nimo[^0-9]{0,40}(\d+)\s*meses/i)

  const plazoMaxMeses = plazoMaxMatch
    ? Number.parseInt(plazoMaxMatch[1], 10)
    : 72
  const plazoMinMeses = plazoMinMatch
    ? Number.parseInt(plazoMinMatch[1], 10)
    : 3

  const ejemploMatch = texto.match(
    /plazo de\s+(\d+)\s*meses[^%]{0,80}TNA/i,
  )
  const plazoMesesEjemplo = ejemploMatch
    ? Number.parseInt(ejemploMatch[1], 10)
    : plazoMaxMeses

  const tasasPorPlazo = [
    {
      plazoMinMeses,
      plazoMaxMeses,
      tna,
      tea,
      cftTea,
    },
  ]

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
      metadata: {
        plazoMesesEjemplo,
        plazoMinMeses,
        plazoMaxMeses,
        tasasPorPlazo,
      },
    },
  ]
}

async function fetchHtmlAxios() {
  const respuesta = await axios.get(URL, {
    responseType: 'text',
    timeout: 10000,
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

async function fetchHtml() {
  const tieneFirecrawl = Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY)

  // En CI/redes restringidas axios a Santander suele timeout; Firecrawl primero.
  if (tieneFirecrawl) {
    try {
      const scraped = await scrapeHtmlWithFirecrawl(log, URL)
      const contenido = scraped.html || scraped.markdown || ''

      if (contenido) return contenido
    } catch (errorFirecrawl) {
      logMensaje(log, 'Firecrawl Santander falló, pruebo axios', {
        errorMessage: errorFirecrawl.message,
      })
    }
  }

  try {
    return await fetchHtmlAxios()
  } catch (errorAxios) {
    logMensaje(log, 'Axios Santander no disponible', {
      errorMessage: errorAxios.message,
    })
    throw errorAxios
  }
}

export async function extraerSantander() {
  try {
    const html = await fetchHtml()
    const ofertas = parsearSantander(html)

    logMensaje(log, 'Santander parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
