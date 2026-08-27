import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import { crearComisionBroker } from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const IEBMAS_HOME_URL = 'https://www.iebmas.com.ar/'
export const IEBMAS_PLANES_URL = 'https://www.iebmas.com.ar/planes'
export const IEBMAS_FAQ_URL = 'https://www.iebmas.com.ar/preguntas-frecuentes'

const log = logGrupo({
  fuente: 'extraerIebMasComisionesBrokers',
  tipo: 'extraccion',
})

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

/** Productos locales del plan Investor (comisión 0% + membresía condicional). */
const PRODUCTOS_INVESTOR = [
  'acciones',
  'bonos',
  'cedears',
  'obligaciones_negociables',
  'letras',
  'cauciones',
  'opciones',
]

const NOTA_MEMBRESIA =
  'Membresía mensual condicional del plan: se debita solo el mes que operás; si no operás, no pagás. No es comisión por operación.'

const NOTA_CERO =
  'IEB+ publica comisiones de operación en cero. El costo relevante es la membresía del plan (membresiaMensual), solo el mes que operás.'

/**
 * @param {string} html
 */
function textoPlano(html) {
  const $ = load(html)
  $('script, style, noscript').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} texto
 * @returns {{ investorArs: number|null, globalUsd: number|null, ceroComisiones: boolean }}
 */
export function parsearCostosIebMasTexto(texto) {
  const plano = String(texto).replace(/\u00a0/g, ' ')

  const ceroComisiones =
    /comisiones para operar con nosotros son cero/i.test(plano) ||
    /operar sin comisiones/i.test(plano) ||
    /cero comisiones/i.test(plano)

  const investorMatch = plano.match(/\$\s*([\d.]+)\s*\+?\s*iva/i)
  const globalMatch = plano.match(/U\s*\$?\s*D\s*([\d]+(?:[.,]\d+)?)\s*\+?\s*iva/i)

  const investorArs = investorMatch
    ? Number.parseInt(investorMatch[1].replace(/\./g, ''), 10)
    : null
  const globalUsd = globalMatch
    ? Number.parseFloat(globalMatch[1].replace(',', '.'))
    : null

  return {
    investorArs: Number.isFinite(investorArs) ? investorArs : null,
    globalUsd: Number.isFinite(globalUsd) ? globalUsd : null,
    ceroComisiones,
  }
}

/**
 * @param {string} html
 */
export function parsearIebMas(html) {
  const plano = textoPlano(html)
  const costos = parsearCostosIebMasTexto(plano)
  /** @type {Array<object>} */
  const filas = []

  if (!costos.ceroComisiones && costos.investorArs == null) {
    return filas
  }

  const membresiaInvestor =
    costos.investorArs != null
      ? {
          membresiaMensual: costos.investorArs,
          membresiaIvaAdicional: true,
        }
      : {
          membresiaMensual: null,
          membresiaIvaAdicional: false,
        }

  const celdaMembresia =
    costos.investorArs != null
      ? `comisión 0% + membresía $${costos.investorArs.toLocaleString('es-AR')} + IVA / mes (si operás)`
      : 'comisiones para operar = cero (plan Investor)'

  const notasInvestor =
    costos.investorArs != null
      ? `${NOTA_CERO} ${NOTA_MEMBRESIA}${
          costos.globalUsd != null
            ? ` Plan Global Markets: U$D ${costos.globalUsd} + IVA/mes si operás internacional.`
            : ''
        }`
      : NOTA_CERO

  for (const producto of PRODUCTOS_INVESTOR) {
    filas.push(
      crearComisionBroker({
        entidad: 'iebmas',
        nombreComercial: 'IEB+',
        producto,
        operacion: 'ambas',
        moneda: 'ARS',
        canal: 'web',
        plan: 'investor',
        tasa: 0,
        tasaBase: null,
        tasaAnualEquivalente: 0,
        tasaEsTope: false,
        incluyeIva: false,
        ivaAdicional: false,
        ...membresiaInvestor,
        enlace: IEBMAS_PLANES_URL,
        metadata: {
          fuenteUrl: IEBMAS_FAQ_URL,
          celdaOriginal: celdaMembresia,
          notas: notasInvestor,
          membresiaCondicional: true,
          membresiaPeriodo: 'mensual',
        },
      }),
    )
  }

  filas.push(
    crearComisionBroker({
      entidad: 'iebmas',
      nombreComercial: 'IEB+',
      producto: 'fci',
      operacion: 'ambas',
      moneda: 'ARS',
      canal: 'web',
      plan: 'rookie',
      tasa: 0,
      tasaBase: null,
      tasaAnualEquivalente: 0,
      tasaEsTope: false,
      incluyeIva: false,
      ivaAdicional: false,
      membresiaMensual: null,
      membresiaIvaAdicional: false,
      enlace: IEBMAS_HOME_URL,
      metadata: {
        fuenteUrl: IEBMAS_FAQ_URL,
        celdaOriginal: 'Plan Rookie: FCI sin comisiones / Gratis',
        notas: 'Plan Rookie gratis (FCI + botoneras MEP/CCL). Sin membresía.',
        membresiaCondicional: false,
      },
    }),
  )

  return filas
}

/**
 * @param {string} html
 */
function pareceUtil(html) {
  const plano = textoPlano(html)
  const costos = parsearCostosIebMasTexto(plano)
  return (
    costos.ceroComisiones ||
    costos.investorArs != null ||
    costos.globalUsd != null
  )
}

async function fetchAxios(url) {
  const respuesta = await axios.get(url, {
    responseType: 'text',
    timeout: 25000,
    headers: BROWSER_HEADERS,
  })
  return String(respuesta.data)
}

async function obtenerHtml() {
  const urls = [IEBMAS_FAQ_URL, IEBMAS_PLANES_URL, IEBMAS_HOME_URL]
  /** @type {string[]} */
  const partes = []

  for (const url of urls) {
    try {
      const html = await fetchAxios(url)
      if (pareceUtil(html)) partes.push(html)
    } catch (error) {
      logMensaje(log, 'IEB+ axios falló', {
        url,
        errorMessage: error.message,
      })
    }
  }

  if (partes.length) return partes.join('\n')

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  logMensaje(log, 'IEB+ axios sin datos, pruebo Firecrawl', {
    url: IEBMAS_FAQ_URL,
  })
  try {
    const scraped = await scrapeHtmlWithFirecrawl(log, IEBMAS_FAQ_URL)
    return scraped.html || scraped.markdown || ''
  } catch {
    return ''
  }
}

export async function extraerIebMas() {
  try {
    const html = await obtenerHtml()
    const comisiones = parsearIebMas(html)
    logMensaje(log, 'IEB+ parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
