import axios from 'axios'
import { load } from 'cheerio'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const SBS_PRODUCTOS_URL =
  'https://www.gruposbs.com/productos-y-servicios/'
/** Typo histórico del filename en el sitio (`arancaeles`). */
export const SBS_PDF_FALLBACK_URL =
  'https://www.gruposbs.com/documentos/arancaeles-trading-2026-abril.pdf'

const log = logGrupo({
  fuente: 'extraerSbsComisionesBrokers',
  tipo: 'extraccion',
})

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

/**
 * Filas retail Quicktrade del PDF (OCR a veces rompe letras).
 * Se toma la última tasa % de la ventana (= columna Cliente Directo Quicktrade).
 * @type {Array<{
 *   labelRe: RegExp,
 *   producto: string,
 *   operacion?: string,
 *   moneda?: string,
 *   exterior?: boolean,
 *   tasaBase?: 'anual'|'tna'|null,
 *   sinCosto?: boolean,
 *   ivaAdicional?: boolean,
 * }>}
 */
const FILAS_SBS = [
  {
    labelRe: /Acciones\s+Locales/i,
    producto: 'acciones',
  },
  {
    // OCR a veces lee CEOEARs
    labelRe: /CE[DO]EARs?(?!\s*<\/|\s*Administrada)/i,
    producto: 'cedears',
  },
  {
    labelRe: /Acciones\s+Exterior/i,
    producto: 'acciones',
    moneda: 'USD',
    exterior: true,
  },
  {
    labelRe: /T[ií]tulos\s+P[uú]blicos[^\n]{0,40}Locales/i,
    producto: 'bonos',
  },
  {
    labelRe: /T[ií]tulos\s+P[uú]blicos[^\n]{0,40}Exterior|Bonos\s+Exterior/i,
    producto: 'bonos',
    moneda: 'USD',
    exterior: true,
  },
  {
    // "Obli aciones Ne ocíables"
    labelRe: /Obli\s*aciones\s+Ne\s*oc[ií]ables|Obligaciones\s+Negociables/i,
    producto: 'obligaciones_negociables',
  },
  {
    labelRe: /Futuros(?!\s+de)/i,
    producto: 'futuros',
  },
  {
    // "O cíones Locales"
    labelRe: /O\s*c[ií]ones\s+Locales|Opciones\s+Locales/i,
    producto: 'opciones',
  },
  {
    labelRe: /Che\s*ue\s+de\s+Pa\s*o\s+Diferido|Cheque\s+de\s+Pago\s+Diferido/i,
    producto: 'cheques',
  },
  {
    labelRe: /Letras\s+del\s+Tesoro\s+ARS/i,
    producto: 'letras',
    moneda: 'ARS',
    tasaBase: 'anual',
  },
  {
    // OCR: USO
    labelRe: /Letras\s+del\s+Tesoro\s+US[DO]/i,
    producto: 'letras',
    moneda: 'USD',
    tasaBase: 'anual',
  },
  {
    labelRe: /Cauci[oó]n\s+Colocadora/i,
    producto: 'cauciones',
    operacion: 'colocadora',
    tasaBase: 'anual',
  },
  {
    labelRe: /Cauci[oó]n\s+Tomadora/i,
    producto: 'cauciones',
    operacion: 'tomadora',
    tasaBase: 'anual',
  },
  {
    labelRe:
      /Fondos\s+Comunes\s+de\s+Inversi[oó]n\s+Abiertos|FCI\s+Abiertos/i,
    producto: 'fci',
    sinCosto: true,
    ivaAdicional: false,
  },
]

/**
 * @param {string} html
 * @returns {string|null}
 */
export function resolverUrlPdfSbs(html) {
  const $ = load(html)
  /** @type {Array<{ href: string, text: string }>} */
  const candidatos = []

  $('a[href*=".pdf"]').each((_, a) => {
    const href = $(a).attr('href')
    if (!href) return
    const text = $(a).text().replace(/\s+/g, ' ').trim()
    candidatos.push({ href, text })
  })

  const preferido =
    candidatos.find((c) =>
      /arancel|arancael|tabla|trading|comisi/i.test(`${c.text} ${c.href}`),
    ) || candidatos[0]

  if (!preferido) return null

  try {
    return new URL(preferido.href, SBS_PRODUCTOS_URL).toString()
  } catch {
    return preferido.href
  }
}

/**
 * Recorta la fila hasta el próximo producto (el PDF aplanado concatena filas).
 * @param {string} plano
 * @param {number} index
 * @param {string} labelMatch
 */
function ventanaFilaSbs(plano, index, labelMatch) {
  const rest = plano.slice(index)
  const skip = Math.max(String(labelMatch).length, 8)
  const tail = rest.slice(skip)

  const proximo =
    /CE[DO]EARs?|Acciones\s+(?:Locales|Exterior)|T[ií]tulos\s+P[uú]blicos|Obli\s*aciones|Obligaciones\s+Negociables|Futuros|O\s*c[ií]ones|Opciones|Che\s*ue|Cheque\s+de|Letras\s+del\s+Tesoro|Fondos\s+Comunes|Cauci[oó]n\s+|Cuenta\s+Administrada|Suscripci[oó]n\s*\/\s*Rescate|Monetarias|Traslado/i

  const mNext = tail.search(proximo)
  const end = mNext >= 0 ? skip + mNext : Math.min(rest.length, 100)
  return rest.slice(0, Math.max(end, skip + 20))
}

/**
 * Mínimo estilo PDF SBS (`$50.00`); no confundir `.00` con miles.
 * @param {string} ventana
 * @returns {number|null}
 */
function minimoSbs(ventana) {
  const m = String(ventana).match(/\$\s*([\d]+)(?:[.,](\d{2}))?(?!\d)/)
  if (!m) return parseComisionMinimaTexto(ventana)
  if (m[2] !== undefined) {
    const n = Number.parseInt(m[1], 10)
    return Number.isFinite(n) ? n : null
  }
  return parseComisionMinimaTexto(m[0])
}

/**
 * Última tasa % de la fila = Quicktrade; opcional sufijo anual.
 * @param {string} ventana
 * @returns {{ tasaTexto: string, minimo: number|null }|null}
 */
function extraerQuicktradeDeVentana(ventana) {
  const rates = [
    ...ventana.matchAll(/([\d]+(?:[.,]\d+)?)\s*%\s*(anual)?/gi),
  ]
  if (!rates.length) return null

  const last = rates[rates.length - 1]
  const tasaTexto = `${last[1]}%${last[2] ? ' anual' : ''}`

  return { tasaTexto, minimo: minimoSbs(ventana) }
}

/**
 * @param {string} texto
 * @param {string} [fuenteUrl]
 */
export function parsearSbsTexto(texto, fuenteUrl = SBS_PDF_FALLBACK_URL) {
  const plano = String(texto).replace(/\u00a0/g, ' ')
  /** @type {Array<object>} */
  const filas = []
  /** @type {Set<string>} */
  const vistos = new Set()

  for (const spec of FILAS_SBS) {
    const m = plano.match(spec.labelRe)
    if (!m || m.index === undefined) continue

    const ventana = ventanaFilaSbs(plano, m.index, m[0])
    const operacion = spec.operacion || 'ambas'
    const moneda = spec.moneda || 'ARS'
    const clave = `${spec.producto}|${operacion}|${moneda}|${spec.exterior ? 'ext' : 'loc'}`
    if (vistos.has(clave)) continue

    if (spec.sinCosto || /sin\s+costo/i.test(ventana)) {
      vistos.add(clave)
      filas.push(
        crearComisionBroker({
          entidad: 'sbs',
          nombreComercial: 'SBS Trading',
          producto: spec.producto,
          operacion,
          moneda,
          canal: 'web',
          plan: 'quicktrade',
          tasa: 0,
          tasaBase: null,
          tasaEsTope: false,
          incluyeIva: false,
          ivaAdicional: spec.ivaAdicional ?? false,
          enlace: SBS_PRODUCTOS_URL,
          metadata: {
            fuenteUrl,
            celdaOriginal: ventana.replace(/\s+/g, ' ').trim().slice(0, 180),
            notas:
              'Cliente Directo Quicktrade (web/app). FCI abiertos sin costo de suscripción/rescate.',
          },
        }),
      )
      continue
    }

    const extraido = extraerQuicktradeDeVentana(ventana)
    if (!extraido) continue

    let tasaTexto = extraido.tasaTexto
    if (spec.tasaBase === 'anual' && !/anual|tna/i.test(tasaTexto)) {
      tasaTexto = `${tasaTexto} anual`
    }

    const parsed = parseTasaComisionTexto(tasaTexto)
    if (parsed.tasa === null) continue

    vistos.add(clave)
    filas.push(
      crearComisionBroker({
        entidad: 'sbs',
        nombreComercial: 'SBS Trading',
        producto: spec.producto,
        operacion,
        moneda,
        canal: 'web',
        plan: 'quicktrade',
        tasa: parsed.tasa,
        tasaBase: spec.tasaBase ?? parsed.tasaBaseHint,
        tasaEsTope: false,
        incluyeIva: false,
        ivaAdicional: spec.ivaAdicional ?? true,
        comisionMinima: extraido.minimo,
        enlace: SBS_PRODUCTOS_URL,
        metadata: {
          fuenteUrl,
          celdaOriginal: ventana.replace(/\s+/g, ' ').trim().slice(0, 180),
          notas: spec.exterior
            ? 'Cliente Directo Quicktrade. Operatoria exterior. IVA y derechos de mercado adicionales según notas del PDF.'
            : 'Cliente Directo Quicktrade (persona humana vía web/app). IVA y derechos de mercado adicionales según notas del PDF.',
          ...(spec.exterior ? { mercado: 'exterior' } : {}),
        },
      }),
    )
  }

  return filas
}

async function descubrirUrlPdf() {
  try {
    const respuesta = await axios.get(SBS_PRODUCTOS_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: BROWSER_HEADERS,
    })
    const desdePagina = resolverUrlPdfSbs(String(respuesta.data))
    if (desdePagina) return { url: desdePagina, origen: 'productos' }
  } catch (error) {
    logMensaje(log, 'SBS productos page falló', { errorMessage: error.message })
  }

  return { url: SBS_PDF_FALLBACK_URL, origen: 'fallback' }
}

export async function extraerSbs() {
  try {
    const descubierto = await descubrirUrlPdf()
    logMensaje(log, 'SBS PDF resuelto', descubierto)

    const respuesta = await axios.get(descubierto.url, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/pdf,*/*',
        Referer: SBS_PRODUCTOS_URL,
      },
    })

    const data = await pdf(Buffer.from(respuesta.data))
    const comisiones = parsearSbsTexto(data.text || '', descubierto.url)
    logMensaje(log, 'SBS Trading parseado', {
      filas: comisiones.length,
      pdfUrl: descubierto.url,
    })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
