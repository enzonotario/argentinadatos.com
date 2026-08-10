import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const PAGE_URL = 'https://www.macro.com.ar/personas/prestamos/personales'
const PDF_URLS = [
  'https://www.macro.com.ar/1517351591909/tasas-de-prestamos-y-descubiertos-en-cuenta-corriente.pdf',
  'https://www.macro.com.ar/1580936235559?d=Any',
]

/** Pares de columnas en las tablas de préstamos personales del PDF (orden de aparición). */
const TABLAS_SEGMENTOS = [
  ['Plan Sueldo', 'Jubilados'],
  ['Mercado Abierto y PyN', 'Renta Presunta'],
  ['Selecta', 'AUH'],
]

const log = logGrupo({
  fuente: 'extraerMacroPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * Resuelve la URL del PDF de tasas desde el HTML de la landing.
 * @param {string} html
 * @returns {string}
 */
export function resolverUrlPdfMacro(html) {
  const $ = load(html)
  const href =
    $('a')
      .filter((_, el) => /tasas vigentes/i.test($(el).text()))
      .first()
      .attr('href') ||
    $('a[href*="tasas-de-prestamos"]').first().attr('href')

  if (!href) return PDF_URLS[0]

  if (href.startsWith('http')) return href

  return new URL(href, 'https://www.macro.com.ar').toString()
}

/**
 * @param {string} token
 * @returns {number|null}
 */
function parseTasaToken(token) {
  if (!token || token === '--') return null
  return parsePorcentaje(token)
}

/** Cortes antes de columnas hipotecarias / descubierto / otras secciones intercaladas. */
const RUIDO_TRAMO =
  /240\s+meses|DESCUBIERTO|TasasCON\s+ACUERDO|SelectaBeneficiarios|ADELANTO\s+DE\s+SUELDO|L[ií]nea\s+UVA|\(\*\)\s*La\s+tasa/i

/**
 * Extrae triples TNA/TEA/CFTEA (o columnas ausentes por `--`) del texto tras un tramo.
 * Ignora porcentajes extra de columnas hipotecarias / descubierto intercaladas.
 * @param {string} chunk
 * @param {number} columnasEsperadas
 * @returns {Array<{ tna: number, tea: number, cftTea: number }|null>}
 */
function extraerColumnasDeChunk(chunk, columnasEsperadas) {
  const bruto = String(chunk)
  const corteRuido = bruto.search(RUIDO_TRAMO)
  const limpio = corteRuido === -1 ? bruto : bruto.slice(0, corteRuido)

  const tokens = [...limpio.matchAll(/\d+[.,]\d+\s*%|--/g)].map((m) =>
    m[0].replace(/\s/g, ''),
  )

  /** @type {Array<{ tna: number, tea: number, cftTea: number }|null>} */
  const columnas = []
  let i = 0

  while (columnas.length < columnasEsperadas && i < tokens.length) {
    if (tokens[i] === '--') {
      columnas.push(null)
      i += 1
      continue
    }

    if (i + 2 >= tokens.length) break
    if (tokens[i + 1] === '--' || tokens[i + 2] === '--') break

    const tna = parseTasaToken(tokens[i])
    const tea = parseTasaToken(tokens[i + 1])
    const cftTea = parseTasaToken(tokens[i + 2])

    if (tna === null || tea === null || cftTea === null) break

    columnas.push({ tna, tea, cftTea })
    i += 3
  }

  while (columnas.length < columnasEsperadas) columnas.push(null)

  return columnas
}

/**
 * Parsea las tablas por tramo de plazo del PDF (texto de pdf-parse).
 * @param {string} textoNormalizado
 * @returns {Map<string, Array<{ plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>>}
 */
export function parsearTablasMacroPdf(textoNormalizado) {
  const texto = String(textoNormalizado)
  const bandMatches = [...texto.matchAll(/(\d+)\s+a\s+(\d+)\s+meses/gi)].filter(
    (m) => Number.parseInt(m[2], 10) <= 72,
  )

  /** @type {Map<string, Array<{ plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>>} */
  const porSegmento = new Map()

  for (const nombre of TABLAS_SEGMENTOS.flat()) {
    porSegmento.set(nombre, [])
  }

  const tramosPorTabla = 7
  const tablasEsperadas = TABLAS_SEGMENTOS.length
  const totalEsperado = tramosPorTabla * tablasEsperadas

  if (bandMatches.length < totalEsperado) {
    return porSegmento
  }

  for (let tablaIdx = 0; tablaIdx < tablasEsperadas; tablaIdx++) {
    const segmentos = TABLAS_SEGMENTOS[tablaIdx]
    const inicio = tablaIdx * tramosPorTabla

    for (let j = 0; j < tramosPorTabla; j++) {
      const match = bandMatches[inicio + j]
      if (!match) continue

      const plazoMinMeses = Number.parseInt(match[1], 10)
      const plazoMaxMeses = Number.parseInt(match[2], 10)
      const start = match.index + match[0].length
      const next = bandMatches[inicio + j + 1]
      const end = next
        ? next.index
        : (() => {
            const ejemplo = texto.indexOf('Ejemplo representativo', start)
            return ejemplo === -1 ? start + 400 : ejemplo
          })()

      const columnas = extraerColumnasDeChunk(texto.slice(start, end), segmentos.length)

      for (let col = 0; col < segmentos.length; col++) {
        const tasas = columnas[col]
        if (!tasas) continue

        porSegmento.get(segmentos[col]).push({
          plazoMinMeses,
          plazoMaxMeses,
          tna: tasas.tna,
          tea: tasas.tea,
          cftTea: tasas.cftTea,
        })
      }
    }
  }

  return porSegmento
}

/**
 * @param {string} segmento
 * @returns {boolean}
 */
function requiereClienteMacro(segmento) {
  return /Plan Sueldo|Selecta|Jubilados/i.test(segmento)
}

/**
 * @param {Array<{ plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>} tasasPorPlazo
 * @returns {{ tna: number, tea: number, cftTea: number }|null}
 */
function tasasDelMayorPlazo(tasasPorPlazo) {
  if (!tasasPorPlazo.length) return null
  return [...tasasPorPlazo].sort((a, b) => b.plazoMaxMeses - a.plazoMaxMeses)[0]
}

/**
 * @param {string} textoPdf
 * @returns {Array<object>}
 */
export function parsearMacroPdf(textoPdf) {
  const texto = String(textoPdf).replace(/\s+/g, ' ')

  const vigenciaMatch = texto.match(
    /Fecha de Vigencia\s*[-–]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  )
  const vigenciaDesde = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[1])
    : null

  /** @type {Map<string, { segmento: string, plazoMeses: number, tna: number, tea: number, cftTea: number }>} */
  const ejemplos = new Map()
  const reEjemplo =
    /Ejemplo representativo para un Pr[ée]stamo Personal\s+(.+?)\s+de\s+\$[\d.]+\s+en\s+(\d+)\s+meses\s+con\s+Tasa Nominal Anual\s*\(TNA\)\s*fija de\s*([\d.,]+)\s*%\s*Tasa Efectiva Anual\s*\(TEA\)\s*de\s*([\d.,]+)\s*%\s*Costo Financiero Total\s*\(CFTEA\)\s*con IVA\s*([\d.,]+)\s*%/gi

  let matchEjemplo
  while ((matchEjemplo = reEjemplo.exec(texto)) !== null) {
    const segmento = matchEjemplo[1].trim()
    const tna = parsePorcentaje(matchEjemplo[3])
    const tea = parsePorcentaje(matchEjemplo[4])
    const cftTea = parsePorcentaje(matchEjemplo[5])

    if (tna === null) continue

    ejemplos.set(segmento, {
      segmento,
      plazoMeses: Number.parseInt(matchEjemplo[2], 10),
      tna,
      tea,
      cftTea,
    })
  }

  const tablas = parsearTablasMacroPdf(texto)
  const segmentosOrden = TABLAS_SEGMENTOS.flat()
  const ofertas = []

  for (const segmento of segmentosOrden) {
    const tasasPorPlazo = tablas.get(segmento) || []
    const ejemplo = ejemplos.get(segmento)

    if (!tasasPorPlazo.length && !ejemplo) continue

    const refTabla = tasasDelMayorPlazo(tasasPorPlazo)
    const tna = ejemplo?.tna ?? refTabla?.tna ?? null
    const tea = ejemplo?.tea ?? refTabla?.tea ?? null
    const cftTea = ejemplo?.cftTea ?? refTabla?.cftTea ?? null

    if (tna === null) continue

    const plazoMinMeses = tasasPorPlazo.length
      ? Math.min(...tasasPorPlazo.map((t) => t.plazoMinMeses))
      : null
    const plazoMaxMeses = tasasPorPlazo.length
      ? Math.max(...tasasPorPlazo.map((t) => t.plazoMaxMeses))
      : null

    /** @type {Record<string, unknown>} */
    const metadata = {
      fuentePdf: true,
    }

    if (ejemplo?.plazoMeses != null) {
      metadata.plazoMesesEjemplo = ejemplo.plazoMeses
    }

    if (tasasPorPlazo.length) {
      metadata.tasasPorPlazo = tasasPorPlazo
      metadata.plazoMinMeses = plazoMinMeses
      metadata.plazoMaxMeses = plazoMaxMeses
    }

    ofertas.push({
      entidad: 'MACRO',
      nombreComercial: 'Macro',
      producto: 'Préstamo personal',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: requiereClienteMacro(segmento),
      condiciones: segmento,
      enlace: PAGE_URL,
      vigenciaDesde,
      vigenciaHasta: null,
      metadata,
    })
  }

  // Fallback: solo ejemplos si las tablas no parsearon
  if (!ofertas.length) {
    for (const ejemplo of ejemplos.values()) {
      ofertas.push({
        entidad: 'MACRO',
        nombreComercial: 'Macro',
        producto: 'Préstamo personal',
        tna: ejemplo.tna,
        tea: ejemplo.tea,
        cftTna: null,
        cftTea: ejemplo.cftTea,
        tipoTasa: 'fija',
        moneda: 'ARS',
        requiereCliente: requiereClienteMacro(ejemplo.segmento),
        condiciones: ejemplo.segmento,
        enlace: PAGE_URL,
        vigenciaDesde,
        vigenciaHasta: null,
        metadata: {
          plazoMesesEjemplo: ejemplo.plazoMeses,
          fuentePdf: true,
        },
      })
    }
  }

  return ofertas
}

async function descargarPdf(url) {
  const pdfRespuesta = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept: 'application/pdf,*/*',
    },
    // El link ?d=Any a veces responde con content-type octet-stream
    validateStatus: (status) => status >= 200 && status < 400,
  })

  return Buffer.from(pdfRespuesta.data)
}

export async function extraerMacro() {
  try {
    // La landing de Macro suele colgar; bajamos el PDF directo.
    let lastError = null

    for (const pdfUrl of PDF_URLS) {
      try {
        logMensaje(log, 'Descargando PDF de tasas Macro', { pdfUrl })
        const buffer = await descargarPdf(pdfUrl)
        const parsed = await pdf(buffer)
        const ofertas = parsearMacroPdf(parsed.text || '')

        if (ofertas.length > 0) {
          logMensaje(log, 'Macro PDF parseado', { ofertas: ofertas.length })
          return ofertas
        }

        lastError = new Error(`PDF sin ofertas parseables: ${pdfUrl}`)
      } catch (errorPdf) {
        lastError = errorPdf
        logMensaje(log, 'Fallo descarga/parse PDF Macro, probando siguiente', {
          pdfUrl,
          errorMessage: errorPdf.message,
        })
      }
    }

    if (lastError) throw lastError

    return []
  } catch (error) {
    logError(log, error)
    return []
  }
}
