import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import { parsePorcentaje, parseFechaTextoEs } from './parsePorcentaje.js'

const URL =
  'https://www.bancor.com.ar/personas/prestamos/prestamos-personales/bancon'

const log = logGrupo({
  fuente: 'extraerBancorPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} texto
 * @returns {{ desde: string|null, hasta: string|null }}
 */
function parsearVigencia(texto) {
  const m = texto.match(
    /Vigencia:\s*desde\s+el\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})\s+al\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+del?\s+(\d{4})/i,
  )

  if (!m) {
    return { desde: null, hasta: null }
  }

  return {
    desde: parseFechaTextoEs(`${m[1]} DE ${m[2]} DE ${m[3]}`),
    hasta: parseFechaTextoEs(`${m[4]} DE ${m[5]} DE ${m[6]}`),
  }
}

/**
 * @param {string} htmlOrText
 * @returns {Array<object>}
 */
export function parsearBancor(htmlOrText) {
  const texto = String(htmlOrText).replace(/\s+/g, ' ')

  const tnaMatch =
    texto.match(/Tasa de Inter[eé]s Fija:\s*TNA\s*([\d.,]+)\s*%/i) ||
    texto.match(/\bTNA\s*([\d.,]+)\s*%/i)

  const teaMatch =
    texto.match(/Tasa Efectiva Anual\s*\(TEA\)\s*del\s*([\d.,]+)\s*%/i) ||
    texto.match(/\bTEA\)?\s*(?:del\s*)?([\d.,]+)\s*%/i)

  const cftMatch =
    texto.match(
      /Costo Financiero Total\s*([\d.,]+)\s*%\s*Efectivo Anual/i,
    ) ||
    texto.match(/CFT en Pesos\s*([\d.,]+)\s*%/i) ||
    texto.match(/\bCFTEA[:\s]+([\d.,]+)\s*%/i)

  const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
  const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null
  const cftTea = cftMatch ? parsePorcentaje(cftMatch[1]) : null

  if (tna === null && cftTea === null) {
    return []
  }

  const plazoMaxMatch =
    texto.match(/Plazo de reintegro:\s*hasta\s+(\d+)\s*meses/i) ||
    texto.match(/hasta\s+(\d+)\s*meses/i)
  const plazoMinMatch = texto.match(
    /Plazo\s+m[ií]nimo[^0-9]{0,40}(\d+)\s*meses/i,
  )

  const plazoMaxMeses = plazoMaxMatch
    ? Number.parseInt(plazoMaxMatch[1], 10)
    : 72
  const plazoMinMeses = plazoMinMatch
    ? Number.parseInt(plazoMinMatch[1], 10)
    : 1

  const ejemploMatch = texto.match(
    /pr[eé]stamo de \$[\s\d.]+,\s*(\d+)\s*cuotas/i,
  )
  const plazoMesesEjemplo = ejemploMatch
    ? Number.parseInt(ejemploMatch[1], 10)
    : plazoMaxMeses

  const { desde: vigenciaDesde, hasta: vigenciaHasta } = parsearVigencia(texto)

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
      entidad: 'BANCOR',
      nombreComercial: 'Bancor',
      producto: 'Préstamo personal Bancón',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: true,
      condiciones: 'Cartera de consumo',
      enlace: URL,
      vigenciaDesde,
      vigenciaHasta,
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

async function fetchHtml() {
  try {
    return await fetchHtmlAxios()
  } catch (errorAxios) {
    logMensaje(log, 'Axios Bancor falló, pruebo Firecrawl', {
      errorMessage: errorAxios.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) {
    throw new Error('Bancor no disponible (axios falló y no hay Firecrawl)')
  }

  const scraped = await scrapeHtmlWithFirecrawl(log, URL)
  const contenido = scraped.html || scraped.markdown || ''

  if (!contenido) {
    throw new Error('Firecrawl Bancor sin contenido')
  }

  return contenido
}

export async function extraerBancor() {
  try {
    const html = await fetchHtml()
    const ofertas = parsearBancor(html)

    logMensaje(log, 'Bancor parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
