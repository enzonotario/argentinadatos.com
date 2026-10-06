import axios from 'axios'
import { load } from 'cheerio'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { crearComisionBroker } from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { scrapePdfMarkdownWithFirecrawl } from '@/shared/extraction/firecrawl/scrapePdfMarkdownWithFirecrawl.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const FIVE_COMISIONES_URL = 'https://fivesa.com.ar/comisiones/'
/** Fallback si la página no expone el botón PDF. */
export const FIVE_PDF_FALLBACK_URL =
  'https://fivesa.com.ar/wp-content/uploads/2025/03/fivesa-comisiones-25.pdf'

const log = logGrupo({
  fuente: 'extraerFiveComisionesBrokers',
  tipo: 'extraccion',
})

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

/** Mínimo de chars útiles para preferir pdf-parse sobre OCR. */
const MIN_PDF_TEXT_CHARS = 200

/**
 * @param {string} html
 * @returns {string|null}
 */
export function resolverUrlPdfFive(html) {
  const $ = load(html)
  /** @type {Array<{ href: string, text: string, score: number }>} */
  const candidatos = []

  $('a[href*=".pdf"]').each((_, a) => {
    const href = $(a).attr('href')
    if (!href) return
    const text = $(a).text().replace(/\s+/g, ' ').trim()
    const blob = `${text} ${href}`
    let score = 0
    if (/descargar/i.test(blob)) score += 3
    if (/arancel|comisi|listado/i.test(blob)) score += 2
    if (/fivesa-comisiones|\.pdf/i.test(href)) score += 1
    candidatos.push({ href, text, score })
  })

  candidatos.sort((a, b) => b.score - a.score)
  const preferido = candidatos[0]
  if (!preferido) return null

  try {
    return new URL(preferido.href, FIVE_COMISIONES_URL).toString()
  } catch {
    return preferido.href
  }
}

/**
 * @param {string} celda
 * @returns {{ pct: number|null, prorrateoDias: number|null }}
 */
function parseMaximoCelda(celda) {
  const raw = String(celda || '').replace(/\u00a0/g, ' ').trim()
  if (!raw || raw === '-' || /^n\/?a$/i.test(raw)) {
    return { pct: null, prorrateoDias: null }
  }

  const m = raw.match(/([\d]+(?:[.,]\d+)?)/)
  if (!m) return { pct: null, prorrateoDias: null }

  const limpio = m[1].includes(',')
    ? m[1].replace(/\./g, '').replace(',', '.')
    : m[1]
  const pct = Number.parseFloat(limpio)
  if (!Number.isFinite(pct)) return { pct: null, prorrateoDias: null }

  const prorrata = raw.match(/[Pp]rorr(?:ata)?\s*(\d+)\s*d[ií]as?/i)
  const prorrateoDias = prorrata
    ? Number.parseInt(prorrata[1], 10)
    : /prorr/i.test(raw)
      ? 90
      : null

  return { pct, prorrateoDias }
}

/**
 * @param {string} linea
 * @returns {string[]}
 */
function celdasMarkdown(linea) {
  const t = String(linea).trim()
  if (!t.startsWith('|')) return []
  return t
    .split('|')
    .slice(1, -1)
    .map((c) => c.replace(/\s+/g, ' ').trim())
}

/**
 * @param {string} concepto
 * @returns {{
 *   productos: string[],
 *   operacion: string,
 *   usarRv: boolean,
 *   usarRf: boolean,
 *   ivaAdicional?: boolean,
 * }|null}
 */
function mapearConceptoFive(concepto) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  if (!t) return null
  if (
    /contado\s+block|plazo\s+firme|indices?|custodia|colocaciones\s+primarias|apertura|mantenimiento|transferencia|remates|mandatos|extraccion|certificado|prestamos?/.test(
      t,
    )
  ) {
    return null
  }

  if (/^contado\b/.test(t)) {
    return {
      productos: [],
      operacion: 'ambas',
      usarRv: true,
      usarRf: true,
    }
  }

  if (/caucion/.test(t)) {
    const operacion = /tomador/.test(t) ? 'tomadora' : 'colocadora'
    return {
      productos: ['cauciones'],
      operacion,
      usarRv: true,
      usarRf: false,
    }
  }

  if (/^pase\b/.test(t)) {
    const operacion = /tomador/.test(t)
      ? 'tomadora'
      : /colocador/.test(t)
        ? 'colocadora'
        : 'ambas'
    return {
      productos: ['alquiler_titulos'],
      operacion,
      usarRv: true,
      usarRf: false,
    }
  }

  if (/opciones?/.test(t) || /futuros?/.test(t) || /derivados?/.test(t)) {
    return {
      productos: ['opciones', 'futuros'],
      operacion: 'ambas',
      usarRv: true,
      usarRf: false,
    }
  }

  if (/licitacion/.test(t)) {
    return {
      productos: ['licitaciones'],
      operacion: 'ambas',
      usarRv: false,
      usarRf: true,
    }
  }

  if (/cheque/.test(t)) {
    return {
      productos: ['cheques'],
      operacion: 'ambas',
      usarRv: true,
      usarRf: false,
      ivaAdicional: true,
    }
  }

  return null
}

/**
 * Expande Contado a productos RV / RF (mismo criterio que Rava).
 * @param {boolean} esRv
 * @returns {string[]}
 */
function productosContado(esRv) {
  return esRv
    ? ['acciones', 'cedears']
    : ['bonos', 'letras', 'obligaciones_negociables']
}

/**
 * @param {string} texto
 * @param {string} [fuenteUrl]
 */
export function parsearFiveTexto(texto, fuenteUrl = FIVE_PDF_FALLBACK_URL) {
  const plano = String(texto || '').replace(/\u00a0/g, ' ')
  if (!plano.trim()) return []

  const factorInternet = /arancel del\s*50\s*%|50\s*%\s*de\s*los\s*expuestos/i.test(
    plano,
  )
    ? 0.5
    : 1

  /** @type {Array<object>} */
  const filas = []
  /** @type {Set<string>} */
  const vistos = new Set()

  /**
   * @param {object} opts
   */
  function pushFila(opts) {
    const {
      producto,
      operacion,
      pct,
      prorrateoDias,
      ivaAdicional,
      celdaOriginal,
    } = opts
    if (pct === null || pct === undefined || !Number.isFinite(pct)) return

    const tasaPublicada = porcentajeADecimal(pct, 6)
    if (tasaPublicada === null) return
    const tasa = porcentajeADecimal(pct * factorInternet, 6)
    if (tasa === null) return

    const clave = `${producto}|${operacion}`
    if (vistos.has(clave)) return
    vistos.add(clave)

    filas.push(
      crearComisionBroker({
        entidad: 'five',
        nombreComercial: 'Five',
        producto,
        operacion,
        moneda: 'ARS',
        canal: 'web',
        plan: null,
        tasa,
        tasaBase: null,
        tasaEsTope: true,
        incluyeIva: false,
        ivaAdicional: Boolean(ivaAdicional),
        prorrateoDias: prorrateoDias ?? null,
        enlace: FIVE_COMISIONES_URL,
        metadata: {
          fuenteUrl,
          celdaOriginal: String(celdaOriginal || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200),
          notas:
            factorInternet < 1
              ? `Arancel máximo publicado ${pct}% (CNV). Canal web/internet = 50% del cuadro.`
              : `Arancel máximo publicado ${pct}% (listado CNV).`,
          tasaPublicada,
          factorInternet,
        },
      }),
    )
  }

  const lineas = plano.split(/\r?\n/)
  for (const linea of lineas) {
    const celdas = celdasMarkdown(linea)
    if (celdas.length < 4) continue
    if (/^conceptos|^---/i.test(celdas[0])) continue
    if (/renta\s*variable|arancel\s*m[ií]nimo|m[aá]ximo\s*%/i.test(celdas[0])) {
      continue
    }

    const concepto = celdas[0]
    const spec = mapearConceptoFive(concepto)
    if (!spec) continue

    // Tablas operativas: concepto + 3 cols RV + 3 cols RF
    // Tablas cortas (cheques): concepto + arancel + min% + max% (+ iva)
    let maxRv = { pct: null, prorrateoDias: null }
    let maxRf = { pct: null, prorrateoDias: null }

    if (celdas.length >= 7) {
      maxRv = parseMaximoCelda(celdas[3])
      maxRf = parseMaximoCelda(celdas[6])
    } else if (celdas.length >= 4) {
      maxRv = parseMaximoCelda(celdas[3])
    }

    if (/^contado\b/i.test(concepto) && !/block/i.test(concepto)) {
      if (spec.usarRv && maxRv.pct !== null) {
        for (const producto of productosContado(true)) {
          pushFila({
            producto,
            operacion: 'ambas',
            pct: maxRv.pct,
            prorrateoDias: maxRv.prorrateoDias,
            ivaAdicional: false,
            celdaOriginal: `${concepto} RV ${celdas[3] || ''}`,
          })
        }
      }
      if (spec.usarRf && maxRf.pct !== null) {
        for (const producto of productosContado(false)) {
          pushFila({
            producto,
            operacion: 'ambas',
            pct: maxRf.pct,
            prorrateoDias: maxRf.prorrateoDias,
            ivaAdicional: false,
            celdaOriginal: `${concepto} RF ${celdas[6] || ''}`,
          })
        }
      }
      continue
    }

    const elegido =
      spec.usarRf && maxRf.pct !== null
        ? maxRf
        : maxRv.pct !== null
          ? maxRv
          : maxRf

    if (elegido.pct === null) continue

    const productos = spec.productos.length
      ? spec.productos
      : []

    for (const producto of productos) {
      pushFila({
        producto,
        operacion: spec.operacion,
        pct: elegido.pct,
        prorrateoDias: elegido.prorrateoDias,
        ivaAdicional: spec.ivaAdicional,
        celdaOriginal: linea,
      })
    }
  }

  return filas
}

async function descubrirUrlPdf() {
  try {
    const respuesta = await axios.get(FIVE_COMISIONES_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: BROWSER_HEADERS,
    })
    const desdePagina = resolverUrlPdfFive(String(respuesta.data))
    if (desdePagina) return { url: desdePagina, origen: 'comisiones' }
  } catch (error) {
    logMensaje(log, 'Five comisiones page falló', {
      errorMessage: error.message,
    })
  }

  return { url: FIVE_PDF_FALLBACK_URL, origen: 'fallback' }
}

/**
 * @param {string} pdfUrl
 * @returns {Promise<string>}
 */
async function obtenerTextoPdf(pdfUrl) {
  try {
    const respuesta = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/pdf,*/*',
        Referer: FIVE_COMISIONES_URL,
      },
    })
    const data = await pdf(Buffer.from(respuesta.data))
    const texto = String(data.text || '').trim()
    if (texto.length >= MIN_PDF_TEXT_CHARS) {
      logMensaje(log, 'Five PDF texto embebido', { chars: texto.length })
      return texto
    }
    logMensaje(log, 'Five PDF sin texto útil, pruebo Firecrawl OCR', {
      chars: texto.length,
    })
  } catch (error) {
    logMensaje(log, 'Five pdf-parse falló, pruebo Firecrawl OCR', {
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) {
    logMensaje(log, 'Five sin VITE_FIRECRAWL_API_KEY, no hay OCR')
    return ''
  }

  return scrapePdfMarkdownWithFirecrawl(log, pdfUrl, {
    mode: 'ocr',
    maxPages: 2,
  })
}

export async function extraerFive() {
  try {
    const descubierto = await descubrirUrlPdf()
    logMensaje(log, 'Five PDF resuelto', descubierto)

    const texto = await obtenerTextoPdf(descubierto.url)
    const comisiones = parsearFiveTexto(texto, descubierto.url)
    logMensaje(log, 'Five parseado', {
      filas: comisiones.length,
      pdfUrl: descubierto.url,
    })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
