import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
  productosDesdeConcepto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const GALICIA_SECURITIES_URL = 'https://www.galiciasecurities.com.ar/Inicio'

const log = logGrupo({
  fuente: 'extraerGaliciaSecuritiesComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * @param {string} concepto
 * @param {string} celda
 * @returns {Array<{ producto: string, operacion: string, tasaTexto: string, comisionMinima: number|null }>}
 */
function expandirFilaGalicia(concepto, celda) {
  const t = String(concepto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/^renta\b|amortizaci|transferencia|conversion|custodia/.test(t)) {
    return []
  }

  // Cheques: celda con Compra/Venta separados.
  if (/cheque|pagare/.test(t)) {
    /** @type {Array<{ producto: string, operacion: string, tasaTexto: string, comisionMinima: number|null }>} */
    const out = []
    const venta = celda.match(/Venta:\s*([^C]+?)(?:Compra:|$)/i)
    const compra = celda.match(/Compra:\s*(.+)$/i)
    if (venta) {
      out.push({
        producto: 'cheques',
        operacion: 'venta',
        tasaTexto: venta[1].trim(),
        comisionMinima: parseComisionMinimaTexto(venta[1]),
      })
    }
    if (compra) {
      out.push({
        producto: 'cheques',
        operacion: 'compra',
        tasaTexto: compra[1].trim(),
        comisionMinima: parseComisionMinimaTexto(compra[1]),
      })
    }
    return out
  }

  const productos = productosDesdeConcepto(concepto)
  if (!productos.length) return []

  return productos.map((producto) => ({
    producto,
    operacion: 'ambas',
    tasaTexto: celda,
    comisionMinima: parseComisionMinimaTexto(celda),
  }))
}

/**
 * @param {string} html
 */
export function parsearGaliciaSecurities(html) {
  const $ = load(html)
  /** @type {Array<object>} */
  const filas = []

  $('table').each((_, table) => {
    const textoTabla = $(table).text()
    if (!/Acciones|CEDEAR|Cauci[oó]n|Futuros|Opciones/i.test(textoTabla)) {
      return
    }

    $(table)
      .find('tr')
      .each((__, tr) => {
        const celdas = $(tr)
          .find('th,td')
          .map((___, c) => $(c).text().replace(/\s+/g, ' ').trim())
          .get()

        if (celdas.length < 2) return
        if (/detalle de los servicios/i.test(celdas[0])) return

        const concepto = celdas[0]
        const celda = celdas[1]
        const expandido = expandirFilaGalicia(concepto, celda)

        for (const item of expandido) {
          const parsed = parseTasaComisionTexto(item.tasaTexto)
          if (parsed.tasa === null) continue

          const esCaucion = item.producto === 'cauciones'

          filas.push(
            crearComisionBroker({
              entidad: 'galicia',
              nombreComercial: 'Galicia Securities',
              producto: item.producto,
              operacion: item.operacion,
              moneda: 'ARS',
              canal: 'web',
              plan: null,
              tasa: parsed.tasa,
              tasaBase: esCaucion ? 'mensual' : parsed.tasaBaseHint,
              tasaEsTope: parsed.tasaEsTope || /hasta/i.test(item.tasaTexto),
              incluyeIva: false,
              ivaAdicional: parsed.ivaAdicional,
              prorrateoDias: esCaucion ? 30 : null,
              comisionMinima: item.comisionMinima,
              enlace: GALICIA_SECURITIES_URL,
              metadata: {
                fuenteUrl: GALICIA_SECURITIES_URL,
                celdaOriginal: `${concepto} | ${item.tasaTexto}`,
                notas: esCaucion
                  ? 'Comisiones máximas bilaterales. Caución en 30 días proporcional al plazo.'
                  : 'Comisiones máximas publicadas (acuerdo bilateral posible).',
              },
            }),
          )
        }
      })
  })

  return filas
}

async function obtenerHtmlGalicia() {
  try {
    const respuesta = await axios.get(GALICIA_SECURITIES_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })
    const html = String(respuesta.data)
    if (/Hasta\s+1[,.]50\s*%/i.test(html) || /Detalle de los servicios/i.test(html)) {
      return html
    }
  } catch (error) {
    logMensaje(log, 'Axios Galicia sin tabla usable', {
      error: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, GALICIA_SECURITIES_URL)
  return scraped.html || ''
}

export async function extraerGaliciaSecurities() {
  try {
    const html = await obtenerHtmlGalicia()
    if (!html) {
      logMensaje(log, 'Galicia sin HTML', {})
      return []
    }

    const comisiones = parsearGaliciaSecurities(html)
    logMensaje(log, 'Galicia Securities parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
