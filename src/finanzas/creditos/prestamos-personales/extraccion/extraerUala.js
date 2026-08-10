import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const URL = 'https://www.uala.com.ar/prestamos'

const log = logGrupo({
  fuente: 'extraerUalaPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * Extrae min/max de un tramo "Tasa … Mínima/o: X% – Máxima/o Y%".
 * @param {string} texto
 * @param {RegExp} label
 * @returns {{ min: number, max: number } | null}
 */
function parsearRangoTasa(texto, label) {
  const re = new RegExp(
    `${label.source}\\s*:\\s*M[ií]nim[ao]\\s*:\\s*([\\d.,]+)\\s*%?\\s*[–\\-]\\s*M[aá]xim[ao]\\s*:?\\s*([\\d.,]+)\\s*%?`,
    'i',
  )
  const m = texto.match(re)

  if (!m) return null

  const min = parsePorcentaje(m[1])
  const max = parsePorcentaje(m[2])

  if (min === null || max === null) return null

  return { min, max }
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearUala(html) {
  const texto = String(html).replace(/\s+/g, ' ')

  const tna = parsearRangoTasa(texto, /Tasa Nominal Anual\s*\(TNA\)/)
  const tea = parsearRangoTasa(texto, /Tasa Efectiva Anual\s*\(TEA\)/)
  const cftTea = parsearRangoTasa(
    texto,
    /Costo Financiero Total(?:\s*Efectivo\s*Anual)?\s*\(CFT(?:EA)?\)/,
  )

  if (!tna || !tea || !cftTea) return []

  return [
    {
      entidad: 'UALA',
      nombreComercial: 'Ualá',
      producto: 'Préstamo personal',
      // Tasas de referencia = mínimas del rango (según perfil crediticio).
      tna: tna.min,
      tea: tea.min,
      cftTna: null,
      cftTea: cftTea.min,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: true,
      condiciones: 'Rango según solicitud',
      enlace: URL,
      vigenciaDesde: null,
      vigenciaHasta: null,
      metadata: {
        rango: {
          tna: { min: tna.min, max: tna.max },
          tea: { min: tea.min, max: tea.max },
          cftTea: { min: cftTea.min, max: cftTea.max },
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

    if (/Tasa Nominal Anual\s*\(TNA\)\s*:?\s*M[ií]nim/i.test(html)) {
      return html
    }

    throw new Error('HTML de Ualá sin tasas de préstamos')
  } catch (errorAxios) {
    logMensaje(log, 'Axios Ualá falló o sin tasas, pruebo Firecrawl', {
      errorMessage: errorAxios.message,
    })

    if (!import.meta.env.VITE_FIRECRAWL_API_KEY) {
      throw errorAxios
    }

    const scraped = await scrapeHtmlWithFirecrawl(log, URL)
    return scraped.html || scraped.markdown || ''
  }
}

export async function extraerUala() {
  try {
    const html = await fetchHtml()
    const ofertas = parsearUala(html)

    logMensaje(log, 'Ualá parseado', { ofertas: ofertas.length })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
