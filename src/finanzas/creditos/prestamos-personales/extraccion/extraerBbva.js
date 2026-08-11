import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parseFechaTextoEs, parsePorcentaje } from './parsePorcentaje.js'

const PAGE_URL =
  'https://www.bbva.com.ar/personas/productos/prestamos/personales.html'
const PDF_URL_FALLBACK = 'https://www.bbva.com.ar/tablas/tasaprestpers.pdf'

const log = logGrupo({
  fuente: 'extraerBbvaPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * Resuelve la URL del PDF de tasas desde el HTML de la landing.
 * @param {string} html
 * @returns {string}
 */
export function resolverUrlPdfBbva(html) {
  const $ = load(html)
  const href =
    $('a[href*="tasaprestpers"]').first().attr('href') ||
    $('a')
      .filter((_, el) => /todas nuestras tasas|tasas vigentes/i.test($(el).text()))
      .first()
      .attr('href')

  if (!href) return PDF_URL_FALLBACK

  if (href.startsWith('http')) return href

  return new URL(href, 'https://www.bbva.com.ar').toString()
}

/**
 * Convierte plazos puntuales del PDF (6, 12, 24…) en tramos contiguos
 * 1–6, 7–12, 13–24… para el simulador.
 * @param {Array<{ plazoMeses: number, tna: number, tea: number, cftTea: number }>} puntos
 * @returns {Array<{ plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>}
 */
export function puntosATramosBbva(puntos) {
  const ordenados = [...puntos].sort((a, b) => a.plazoMeses - b.plazoMeses)
  /** @type {Array<{ plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>} */
  const tramos = []

  for (let i = 0; i < ordenados.length; i++) {
    const punto = ordenados[i]
    const plazoMinMeses = i === 0 ? 1 : ordenados[i - 1].plazoMeses + 1
    tramos.push({
      plazoMinMeses,
      plazoMaxMeses: punto.plazoMeses,
      tna: punto.tna,
      tea: punto.tea,
      cftTea: punto.cftTea,
    })
  }

  return tramos
}

/**
 * @param {string} textoPdf
 * @returns {Array<object>}
 */
export function parsearBbvaPdf(textoPdf) {
  const texto = String(textoPdf).replace(/\s+/g, ' ')

  const vigenciaMatch = texto.match(
    /v[aá]lida desde el\s+(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})\s+hasta el\s+(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})/i,
  )
  const vigenciaDesde = vigenciaMatch
    ? parseFechaTextoEs(vigenciaMatch[1])
    : null
  const vigenciaHasta = vigenciaMatch
    ? parseFechaTextoEs(vigenciaMatch[2])
    : null

  const requiereCliente = /exclusiva para clientes(?:\s+de)?\s+BBVA/i.test(texto)

  /** @type {Array<{ plazoMeses: number, tna: number, tea: number, cftTea: number }>} */
  const puntos = []
  const re =
    /(\d+)\s+meses\s*([\d.,]+)\s*%\s*([\d.,]+)\s*%\s*([\d.,]+)\s*%/gi

  let match
  while ((match = re.exec(texto)) !== null) {
    const plazoMeses = Number.parseInt(match[1], 10)
    const tna = parsePorcentaje(match[2])
    const tea = parsePorcentaje(match[3])
    const cftTea = parsePorcentaje(match[4])

    if (!plazoMeses || tna === null || tea === null || cftTea === null) continue
    if (plazoMeses > 120) continue

    puntos.push({ plazoMeses, tna, tea, cftTea })
  }

  if (!puntos.length) return []

  const tasasPorPlazo = puntosATramosBbva(puntos)
  const ref =
    puntos.find((p) => p.plazoMeses === 72) ||
    [...puntos].sort((a, b) => b.plazoMeses - a.plazoMeses)[0]

  const ejemploMatch = texto.match(
    /Ejemplo para un Pr[ée]stamo Personal de\s*\$[\d.]+\s+en\s+(\d+)\s+meses/i,
  )
  const plazoMesesEjemplo = ejemploMatch
    ? Number.parseInt(ejemploMatch[1], 10)
    : ref.plazoMeses

  return [
    {
      entidad: 'BBVA',
      nombreComercial: 'BBVA',
      producto: 'Préstamo personal',
      tna: ref.tna,
      tea: ref.tea,
      cftTna: null,
      cftTea: ref.cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente,
      condiciones: requiereCliente
        ? 'Oferta exclusiva para clientes BBVA'
        : null,
      enlace: PAGE_URL,
      vigenciaDesde,
      vigenciaHasta,
      metadata: {
        fuentePdf: true,
        plazoMesesEjemplo,
        plazoMinMeses: tasasPorPlazo[0].plazoMinMeses,
        plazoMaxMeses: tasasPorPlazo[tasasPorPlazo.length - 1].plazoMaxMeses,
        tasasPorPlazo,
      },
    },
  ]
}

/**
 * Fallback: tasas del HTML (sin tabla por plazo).
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearBbva(html) {
  const $ = load(html)

  const cftTeaTexto = $('span.cft_pesos').first().text()
  const cftTeaMatch = cftTeaTexto.match(/CFTEA:\s*([\d.,]+)\s*%/i)
  const cftTea = cftTeaMatch ? parsePorcentaje(cftTeaMatch[1]) : null

  const disclaimer = $('h4.disclaimer__title').first().text()
  const tnaMatch = disclaimer.match(
    /Tasa Nominal Anual:\s*([\d.,]+)\s*%/i,
  )
  const teaMatch = disclaimer.match(
    /Tasa Efectiva Anual:\s*([\d.,]+)\s*%/i,
  )

  const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
  const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null

  if (tna === null && cftTea === null) {
    return []
  }

  const legal = $.root().text().replace(/\s+/g, ' ')

  const vigenciaMatch = legal.match(
    /V[ÁA]LIDA DEL\s+(\d{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+\s+DE\s+\d{4})\s+HASTA EL\s+(\d{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+\s+DE\s+\d{4})/i,
  )

  const requiereCliente = /EXCLUSIVA PARA CLIENTES BBVA/i.test(legal)

  return [
    {
      entidad: 'BBVA',
      nombreComercial: 'BBVA',
      producto: 'Préstamo personal',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente,
      condiciones: requiereCliente
        ? 'Oferta exclusiva para clientes BBVA'
        : null,
      enlace: PAGE_URL,
      vigenciaDesde: vigenciaMatch
        ? parseFechaTextoEs(vigenciaMatch[1])
        : null,
      vigenciaHasta: vigenciaMatch
        ? parseFechaTextoEs(vigenciaMatch[2])
        : null,
      metadata: {},
    },
  ]
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
    validateStatus: (status) => status >= 200 && status < 400,
  })

  return Buffer.from(pdfRespuesta.data)
}

export async function extraerBbva() {
  try {
    let html = ''
    let pdfUrl = PDF_URL_FALLBACK

    try {
      const respuesta = await axios.get(PAGE_URL, {
        responseType: 'text',
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
        },
      })
      html = respuesta.data
      pdfUrl = resolverUrlPdfBbva(html)
    } catch (errorHtml) {
      logMensaje(log, 'Fallo HTML BBVA, usando PDF fallback', {
        errorMessage: errorHtml.message,
      })
    }

    try {
      logMensaje(log, 'Descargando PDF de tasas BBVA', { pdfUrl })
      const buffer = await descargarPdf(pdfUrl)
      const parsed = await pdf(buffer)
      const ofertasPdf = parsearBbvaPdf(parsed.text || '')

      if (ofertasPdf.length > 0) {
        logMensaje(log, 'BBVA PDF parseado', {
          ofertas: ofertasPdf.length,
          tramos: ofertasPdf[0].metadata?.tasasPorPlazo?.length,
        })
        return ofertasPdf
      }
    } catch (errorPdf) {
      logMensaje(log, 'Fallo PDF BBVA, fallback HTML', {
        pdfUrl,
        errorMessage: errorPdf.message,
      })
    }

    if (html) return parsearBbva(html)

    return []
  } catch (error) {
    logError(log, error)
    return []
  }
}
