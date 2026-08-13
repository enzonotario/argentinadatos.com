import axios from 'axios'
import * as cheerio from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const OPENPAY_COMISIONES_URL =
  'https://www.openpayargentina.com.ar/comisiones'

const log = logGrupo({
  fuente: 'extraerOpenpayComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_IVA =
  'Comisiones expresadas sin IVA; el plazo es en días hábiles a la cuenta digital.'

const CONDICION_INMEDIATO =
  'La habilitación de pago inmediato depende del análisis de Openpay sobre cada comercio.'

const CONDICION_QR =
  'Para ventas con saldo en cuenta. En QR con tarjetas de débito o crédito aplican las condiciones de cada medio.'

const CONDICION_CANALES =
  'También aplica a QR con tarjetas, link de pago y checkout.'

/**
 * @param {string} titulo
 */
function mapearMedioOpenpay(titulo) {
  const t = String(titulo).replace(/\s+/g, ' ').trim().toLowerCase()

  if (/qr/.test(t) || /dinero en cuenta/.test(t)) {
    return {
      producto: 'QR dinero en cuenta',
      canal: 'qr',
      medioPago: 'qr_cuenta',
    }
  }

  if (/d[eé]bito/.test(t)) {
    return {
      producto: 'Débito',
      canal: 'pos',
      medioPago: 'debito',
    }
  }

  if (/cr[eé]dito/.test(t)) {
    return {
      producto: 'Crédito',
      canal: 'pos',
      medioPago: 'credito',
    }
  }

  return null
}

/**
 * @param {string} label
 */
function parsearAcreditacionOpenpay(label) {
  const t = String(label).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

  if (/inmediata|inmediato|al instante|en el acto/.test(t)) {
    return {
      tipo: 'inmediata',
      plazo: 0,
      label: /pago inmediato/.test(t)
        ? 'Pago inmediato'
        : 'Acreditación inmediata',
    }
  }

  const dias = t.match(/(\d+)\s*d[ií]as?/)
  if (dias) {
    const plazo = Number.parseInt(dias[1], 10)
    return {
      tipo: plazo === 1 ? 'anticipada' : 'estandar',
      plazo,
      label: `${plazo} día${plazo === 1 ? '' : 's'} hábil${plazo === 1 ? '' : 'es'}`,
    }
  }

  return {
    tipo: 'desconocida',
    plazo: null,
    label: String(label).replace(/\s+/g, ' ').trim() || null,
  }
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearOpenpay(html) {
  const $ = cheerio.load(String(html))
  const $row = $('.opcionesRow')
    .filter((_, el) => /comisiones por ventas/i.test($(el).text()))
    .first()
  const $cols = $row.length ? $row.find('.opcionCol') : $('.opcionCol')

  /** @type {Array<object>} */
  const comisiones = []

  $cols.each((_, col) => {
    const $col = $(col)
    const titulo = $col
      .find('.costoImagenes, h4.tituloPrincipal')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
    const medio = mapearMedioOpenpay(titulo)
    if (!medio) return

    $col.find('.costoCol').each((__, cell) => {
      const $cell = $(cell)
      const numero = $cell.find('.costoNumero').text()
      const plazoTexto = $cell.find('.costoAbajo').text()
      const parsed = parseArancelTexto(`${numero} + IVA`)

      if (parsed.arancel === null) return

      const acreditacion = parsearAcreditacionOpenpay(plazoTexto)
      const condiciones = [
        CONDICION_IVA,
        medio.medioPago === 'qr_cuenta' ? CONDICION_QR : CONDICION_CANALES,
        acreditacion.tipo === 'inmediata' && medio.medioPago !== 'qr_cuenta'
          ? CONDICION_INMEDIATO
          : null,
      ]
        .filter(Boolean)
        .join(' ')

      comisiones.push(
        crearComisionCobro({
          entidad: 'openpay',
          nombreComercial: 'Openpay',
          producto: medio.producto,
          canal: medio.canal,
          medioPago: medio.medioPago,
          arancel: parsed.arancel,
          arancelEsTope: false,
          incluyeIva: false,
          ivaAdicional: true,
          acreditacionTipo: acreditacion.tipo,
          acreditacionPlazoHabiles: acreditacion.plazo,
          acreditacionLabel: acreditacion.label,
          condiciones,
          enlace: OPENPAY_COMISIONES_URL,
          metadata: {
            fuenteUrl: OPENPAY_COMISIONES_URL,
            tituloOriginal: titulo,
            celdaOriginal: `${numero} ${plazoTexto}`
              .replace(/\s+/g, ' ')
              .trim(),
          },
        }),
      )
    })
  })

  return comisiones
}

async function fetchAxios() {
  const respuesta = await axios.get(OPENPAY_COMISIONES_URL, {
    responseType: 'text',
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  return String(respuesta.data)
}

async function obtenerHtml() {
  try {
    const html = await fetchAxios()
    if (parsearOpenpay(html).length) return html
    logMensaje(log, 'Openpay axios sin cards, pruebo Firecrawl')
  } catch (error) {
    logMensaje(log, 'Openpay axios falló, pruebo Firecrawl', {
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, OPENPAY_COMISIONES_URL)
  return scraped.html || scraped.markdown || ''
}

export async function extraerOpenpay() {
  try {
    const html = await obtenerHtml()
    const comisiones = parsearOpenpay(html)

    logMensaje(log, 'Openpay parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
