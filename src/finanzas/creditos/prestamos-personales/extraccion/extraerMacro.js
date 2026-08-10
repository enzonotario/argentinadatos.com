import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const PAGE_URL = 'https://www.macro.com.ar/personas/prestamos/personales'
const PDF_FALLBACK =
  'https://www.macro.com.ar/1517351591909/tasas-de-prestamos-y-descubiertos-en-cuenta-corriente.pdf'

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

  if (!href) return PDF_FALLBACK

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

export async function extraerMacro() {
  try {
    let pdfUrl = PDF_FALLBACK

    try {
      const pagina = await axios.get(PAGE_URL, {
        responseType: 'text',
        timeout: 12000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
        },
      })

      pdfUrl = resolverUrlPdfMacro(pagina.data)
    } catch (errorPagina) {
      logError(log, errorPagina)
    }

    const pdfRespuesta = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
        Accept: 'application/pdf,*/*',
      },
    })

    const parsed = await pdf(Buffer.from(pdfRespuesta.data))

    return parsearMacroPdf(parsed.text || '')
  } catch (error) {
    logError(log, error)
    return []
  }
}
