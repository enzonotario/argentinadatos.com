import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  normalizarProducto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const COCOS_TARIFARIO_URL = 'https://cocos.capital/tarifario'

const log = logGrupo({
  fuente: 'extraerCocosComisionesBrokers',
  tipo: 'extraccion',
})

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  Referer: 'https://cocos.capital/',
}

/**
 * Índice de columna "Comisión web/app" → Personas humanas.
 * Headers: Concepto | Todos (operador) | Personas humanas (web/app) | ...
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Element} table
 * @returns {number}
 */
function indiceColumnaWebAppPersonasHumanas($, table) {
  const filasHeader = $(table).find('tr').slice(0, 3)
  let idx = 2

  filasHeader.each((_, tr) => {
    $(tr)
      .find('th,td')
      .each((i, cell) => {
        const texto = $(cell).text().replace(/\s+/g, ' ').trim()
        if (/personas humanas/i.test(texto)) {
          idx = i
        }
      })
  })

  return idx
}

/**
 * @param {string} concepto
 * @returns {{ producto: string, operacion: string }|null}
 */
function clasificarConceptoCocos(concepto) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  // Fuera de catálogo comparable
  if (/mep|liquidacion usd|descubierto|tarifa mensual|custodia/.test(t)) {
    return null
  }

  const producto = normalizarProducto(concepto)
  if (!producto) return null

  let operacion = 'ambas'
  if (/caucion|alquiler/.test(t)) {
    if (/tomadora|tomador/.test(t)) operacion = 'tomadora'
    else if (/colocadora|colocador/.test(t)) operacion = 'colocadora'
  } else if (/^compra\b/.test(t) && !/venta/.test(t)) {
    operacion = 'compra'
  } else if (/^venta\b/.test(t) && !/compra/.test(t)) {
    operacion = 'venta'
  }

  return { producto, operacion }
}

/**
 * @param {string} html
 */
export function parsearCocos(html) {
  const $ = load(html)
  /** @type {Array<object>} */
  const filas = []

  $('table').each((_, table) => {
    const colWebApp = indiceColumnaWebAppPersonasHumanas($, table)

    $(table)
      .find('tr')
      .each((__, tr) => {
        const celdas = $(tr)
          .find('th,td')
          .map((___, c) => $(c).text().replace(/\s+/g, ' ').trim())
          .get()

        if (celdas.length <= colWebApp) return

        const concepto = celdas[0]
        const clase = clasificarConceptoCocos(concepto)
        if (!clase) return

        const celda = celdas[colWebApp]
        const parsed = parseTasaComisionTexto(celda)
        if (parsed.tasa === null) return

        const tasaBase =
          parsed.tasaBaseHint ||
          (clase.producto === 'cauciones' || clase.producto === 'cheques'
            ? 'tna'
            : null)

        filas.push(
          crearComisionBroker({
            entidad: 'cocos',
            nombreComercial: 'Cocos',
            producto: clase.producto,
            operacion: clase.operacion,
            moneda: 'ARS',
            canal: 'web',
            plan: 'personas_humanas',
            tasa: parsed.tasa,
            tasaBase,
            tasaEsTope: false,
            incluyeIva: false,
            ivaAdicional: parsed.ivaAdicional,
            prorrateoDias: null,
            derechoMercado: null,
            enlace: COCOS_TARIFARIO_URL,
            metadata: {
              fuenteUrl: COCOS_TARIFARIO_URL,
              celdaOriginal: `${concepto} | web/app personas humanas: ${celda}`,
              notas:
                'Columna default retail: Comisión web/app → Personas humanas.',
            },
          }),
        )
      })
  })

  return filas
}

/**
 * @param {string} html
 */
function pareceChallengeOVacio(html) {
  const raw = String(html || '')
  if (raw.length < 2000) return true
  if (/just a moment|cf-browser-verification|challenge-platform/i.test(raw)) {
    return true
  }
  return !/(cauci[oó]n|acciones|cedear)/i.test(raw)
}

async function obtenerHtmlCocos() {
  try {
    const respuesta = await axios.get(COCOS_TARIFARIO_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: BROWSER_HEADERS,
    })
    const html = String(respuesta.data)
    if (!pareceChallengeOVacio(html) && parsearCocos(html).length) {
      return html
    }
    logMensaje(log, 'Cocos axios sin tasas, pruebo Firecrawl', {
      length: html.length,
    })
  } catch (error) {
    logMensaje(log, 'Cocos axios falló, pruebo Firecrawl', {
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, COCOS_TARIFARIO_URL)
  return scraped.html || scraped.markdown || ''
}

export async function extraerCocos() {
  try {
    const html = await obtenerHtmlCocos()
    const comisiones = parsearCocos(html)
    logMensaje(log, 'Cocos parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
