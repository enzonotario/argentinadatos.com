import axios from 'axios'
import https from 'node:https'
import * as cheerio from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionCobro,
  inferirAcreditacionTipo,
  parseArancelTexto,
  parsePlazoHabilesDesdeLabel,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const PAYWAY_PLANES_URL = 'https://www.payway.com.ar/planes-precios'

const log = logGrupo({
  fuente: 'extraerPaywayComisionesCobro',
  tipo: 'extraccion',
})

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})

/**
 * @param {string} titulo
 * @returns {{ producto: string, canal: string, medioPago: string }|null}
 */
function mapearMedioPayway(titulo) {
  const texto = String(titulo)
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = texto.toLowerCase()

  if (/qr/.test(lower) || /dinero en cuenta/.test(lower)) {
    return {
      producto: 'QR dinero en cuenta',
      canal: 'qr',
      medioPago: 'qr_cuenta',
    }
  }

  if (/d[eé]bito/.test(lower)) {
    return {
      producto: 'Débito',
      canal: 'pos',
      medioPago: 'debito',
    }
  }

  if (/cr[eé]dito/.test(lower)) {
    return {
      producto: 'Crédito 1 pago',
      canal: 'pos',
      medioPago: 'credito',
    }
  }

  return null
}

/**
 * @param {string} html
 * @returns {string|null}
 */
function extraerNota(html, clave) {
  const texto = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

  if (clave === 'qr') {
    const match = texto.match(
      /\(\*{3}\)\s*([^(*]{20,400}?)(?:\(\*|$)/,
    )
    return match ? match[1].trim() : null
  }

  if (clave === 'anticipado') {
    const match = texto.match(
      /\(\*{2}\)\s*([^(*]{20,300}?)(?:\(\*|$)/,
    )
    return match ? match[1].trim() : null
  }

  if (clave === 'visa') {
    const match = texto.match(
      /\(\*\)\s*([^(*]{20,400}?)(?:\(\*|$)/,
    )
    return match ? match[1].trim() : null
  }

  return null
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearPayway(html) {
  const $ = cheerio.load(String(html))
  const notaQr =
    extraerNota(html, 'qr') ||
    '0% los primeros 3 meses si el comercio cumple las condiciones BCRA (punto 6.3.1.1).'
  const notaAnticipado =
    extraerNota(html, 'anticipado') ||
    'Incluye el precio del servicio de Cobro Anticipado.'
  const notaVisa =
    extraerNota(html, 'visa') ||
    'Ejemplo para terminales Payway con Visa emitidas en Argentina; 8 días hábiles (Com. A 7153 BCRA) para micro, pequeños comercios y personas humanas.'

  /** @type {Array<object>} */
  const comisiones = []
  let acreditacionActual = null

  $('h3, .paragraph-porcentaje').each((_, el) => {
    const $el = $(el)

    if ($el.is('h3')) {
      const heading = $el.text().replace(/\s+/g, ' ').trim()

      if (/[¿?]/.test(heading) || !heading) {
        acreditacionActual = null
        return
      }

      const tipo = inferirAcreditacionTipo(heading)
      const plazo = parsePlazoHabilesDesdeLabel(heading)

      if (tipo === 'desconocida' && plazo == null) {
        acreditacionActual = null
        return
      }

      acreditacionActual = {
        tipo,
        plazo,
        label: heading.replace(/\*+/g, '').trim(),
      }
      return
    }

    if (!acreditacionActual) return

    const titulo = $el
      .find('.field--name-field-titulo, .field-titulo')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
    const porcentaje = $el.find('.campo-porcentaje').first().text()
    const ivaTexto = $el.find('span').text()
    const medio = mapearMedioPayway(titulo)

    if (!medio || !porcentaje) return

    const parsed = parseArancelTexto(`${titulo} ${porcentaje} ${ivaTexto}`)

    if (parsed.arancel === null) return

    let condiciones = notaVisa
    if (medio.medioPago === 'qr_cuenta') {
      condiciones = notaQr
    } else if (
      medio.medioPago === 'credito' &&
      acreditacionActual.tipo === 'anticipada'
    ) {
      condiciones = notaAnticipado
    }

    comisiones.push(
      crearComisionCobro({
        entidad: 'payway',
        nombreComercial: 'Payway',
        producto: medio.producto,
        canal: medio.canal,
        medioPago: medio.medioPago,
        arancel: parsed.arancel,
        arancelEsTope: parsed.arancelEsTope || /hasta/i.test(titulo),
        incluyeIva: false,
        ivaAdicional: true,
        acreditacionTipo: acreditacionActual.tipo,
        acreditacionPlazoHabiles: acreditacionActual.plazo,
        acreditacionLabel: acreditacionActual.label,
        condiciones,
        enlace: PAYWAY_PLANES_URL,
        metadata: {
          fuenteUrl: PAYWAY_PLANES_URL,
          tituloOriginal: titulo,
        },
      }),
    )
  })

  return comisiones
}

async function fetchHtml() {
  const respuesta = await axios.get(PAYWAY_PLANES_URL, {
    responseType: 'text',
    timeout: 20000,
    httpsAgent,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  return String(respuesta.data)
}

export async function extraerPayway() {
  try {
    const html = await fetchHtml()
    const comisiones = parsearPayway(html)

    logMensaje(log, 'Payway parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
