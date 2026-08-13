import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const FISERV_SERVICIOS_QR_URL =
  'https://www.fiserv.com.ar/servicios/pagos-qr/'
export const FISERV_PAGOSCONQR_URL = 'https://www.fiserv.com.ar/pagosconqr/'

const FISERV_QR_URLS = [FISERV_SERVICIOS_QR_URL, FISERV_PAGOSCONQR_URL]

const log = logGrupo({
  fuente: 'extraerFiservComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_CREDITO_DEFAULT =
  'Planes Ahora 10 DH, Grandes Contribuyentes 18 DH, Cuotas con Financiación otorgante 2 DH, Plan Cuota a Cuota 1° cuota 18 DH, Tarjeta local no financiera 18 DH.'

/**
 * @param {string} raw
 * @returns {string}
 */
export function textoPlanoFiserv(raw) {
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\\(?=[+*()])/g, '')
    .replace(/(\d)\s*,\s*(\d)/g, '$1,$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} texto
 * @returns {boolean}
 */
function esCaptcha(texto) {
  return /radware|bot manager captcha|perfdrive/i.test(texto)
}

/**
 * @param {string} ventana
 */
function parsearAcreditacionFiserv(ventana) {
  const t = String(ventana)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/inmediata|en el momento/.test(t)) {
    return {
      tipo: 'inmediata',
      plazo: 0,
      label: 'Acreditación inmediata',
    }
  }

  if (/24\s*horas/.test(t)) {
    return {
      tipo: 'anticipada',
      plazo: 1,
      label: '24 horas hábiles',
    }
  }

  const dias = t.match(/(\d+)\s*d[ií]as?\s*habiles/)
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
    label: null,
  }
}

/**
 * @param {string} texto
 * @param {RegExp} startRe
 * @param {number} [desde=0]
 * @returns {string}
 */
function ventanaDesde(texto, startRe, desde = 0) {
  const slice = texto.slice(desde)
  const match = slice.match(startRe)
  if (!match || match.index == null) return ''
  return slice.slice(match.index, match.index + 420)
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearFiserv(html) {
  const texto = textoPlanoFiserv(html)

  if (!texto || esCaptcha(texto)) return []

  const pctIdx = texto.search(/Pagos con Transferencia\s*\(PCT\)/i)
  if (pctIdx < 0) return []

  const notaMatch = texto.match(
    /(Planes Ahora\s+10\s*DH[\s\S]{10,250}?Tarjeta local no financiera\s+18\s*DH\.?)/i,
  )
  const condicionesCredito = notaMatch
    ? notaMatch[1].replace(/\s+/g, ' ').trim()
    : CONDICION_CREDITO_DEFAULT

  const bloques = [
    {
      producto: 'QR transferencia (PCT)',
      canal: 'qr',
      medioPago: 'qr_cuenta',
      ventana: ventanaDesde(texto, /Pagos con Transferencia\s*\(PCT\)/i),
      condiciones: null,
    },
    {
      producto: 'QR débito',
      canal: 'qr',
      medioPago: 'debito',
      ventana:
        ventanaDesde(texto, /Pagos\s+con\s+D[eé]bito/i) ||
        ventanaDesde(
          texto,
          /D[eé]bito(?=\s+Dinero Disponible|\s+Arancel)/i,
          pctIdx,
        ),
      condiciones: null,
    },
    {
      producto: 'QR crédito 1 pago',
      canal: 'qr',
      medioPago: 'credito',
      ventana:
        ventanaDesde(texto, /Pagos\s+con\s+Cr[eé]dito/i) ||
        ventanaDesde(texto, /Cr[eé]dito(?=\s+Dinero Disponible)/i, pctIdx),
      condiciones: condicionesCredito,
    },
  ]

  /** @type {Array<object>} */
  const comisiones = []

  for (const bloque of bloques) {
    if (!bloque.ventana) continue

    const parsed = parseArancelTexto(bloque.ventana)
    if (parsed.arancel === null) continue

    const acreditacion = parsearAcreditacionFiserv(bloque.ventana)

    comisiones.push(
      crearComisionCobro({
        entidad: 'fiserv',
        nombreComercial: 'Fiserv',
        producto: bloque.producto,
        canal: bloque.canal,
        medioPago: bloque.medioPago,
        arancel: parsed.arancel,
        arancelEsTope: parsed.arancelEsTope,
        incluyeIva: parsed.incluyeIva,
        ivaAdicional: parsed.ivaAdicional,
        acreditacionTipo: acreditacion.tipo,
        acreditacionPlazoHabiles: acreditacion.plazo,
        acreditacionLabel: acreditacion.label,
        condiciones: bloque.condiciones,
        enlace: FISERV_SERVICIOS_QR_URL,
        metadata: {
          fuenteUrl: FISERV_SERVICIOS_QR_URL,
        },
      }),
    )
  }

  return comisiones
}

async function fetchAxios(url) {
  const respuesta = await axios.get(url, {
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

async function fetchFirecrawl(url) {
  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, url)
  return `${scraped.html || ''}\n${scraped.markdown || ''}`
}

async function obtenerContenido(url) {
  try {
    const html = await fetchAxios(url)
    if (!esCaptcha(textoPlanoFiserv(html))) return html
    logMensaje(log, 'Fiserv axios devolvió captcha, pruebo Firecrawl', {
      url,
    })
  } catch (error) {
    logMensaje(log, 'Fiserv axios falló, pruebo Firecrawl', {
      url,
      errorMessage: error.message,
    })
  }

  return fetchFirecrawl(url)
}

export async function extraerFiserv() {
  try {
    for (const url of FISERV_QR_URLS) {
      const contenido = await obtenerContenido(url)
      const comisiones = parsearFiserv(contenido)

      if (comisiones.length) {
        logMensaje(log, 'Fiserv parseado', {
          filas: comisiones.length,
          url,
        })
        return comisiones.map(fila => ({
          ...fila,
          enlace: url,
          metadata: {
            ...fila.metadata,
            fuenteUrl: url,
          },
        }))
      }
    }

    logMensaje(log, 'Fiserv sin filas parseables')
    return []
  } catch (error) {
    logError(log, error)
    return []
  }
}
