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

  const ofertas = []
  const re =
    /Ejemplo representativo para un Pr[ée]stamo Personal\s+(.+?)\s+de\s+\$[\d.]+\s+en\s+(\d+)\s+meses\s+con\s+Tasa Nominal Anual\s*\(TNA\)\s*fija de\s*([\d.,]+)\s*%\s*Tasa Efectiva Anual\s*\(TEA\)\s*de\s*([\d.,]+)\s*%\s*Costo Financiero Total\s*\(CFTEA\)\s*con IVA\s*([\d.,]+)\s*%/gi

  let match

  while ((match = re.exec(texto)) !== null) {
    const segmento = match[1].trim()
    const plazoMeses = Number.parseInt(match[2], 10)
    const tna = parsePorcentaje(match[3])
    const tea = parsePorcentaje(match[4])
    const cftTea = parsePorcentaje(match[5])

    if (tna === null) continue

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
      requiereCliente: /Plan Sueldo|Selecta|Jubilados/i.test(segmento),
      condiciones: segmento,
      enlace: PAGE_URL,
      vigenciaDesde,
      vigenciaHasta: null,
      metadata: {
        plazoMesesEjemplo: plazoMeses,
        fuentePdf: true,
      },
    })
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
