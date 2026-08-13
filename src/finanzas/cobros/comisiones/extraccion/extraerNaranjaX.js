import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const NARANJAX_TERMINAL_URL =
  'https://www.naranjax.com/beneficios-comercios'
export const NARANJAX_QR_URL = 'https://www.naranjax.com/codigo-qr-comercios'
export const NARANJAX_TAP_URL = 'https://www.naranjax.com/cobro-tap-comercios'

const log = logGrupo({
  fuente: 'extraerNaranjaXComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_IVA = 'Comisiones sin IVA.'

const CONDICION_TERMINAL_ARANCEL =
  'Además, todas las transacciones con tarjetas de crédito tienen un arancel por venta del 1,8% + IVA.'

const CONDICION_QR_PROMO =
  'Promoción: 0% durante los primeros 3 meses o hasta 1.000 UVAs, solo en pagos con dinero en cuenta.'

/**
 * @param {string} raw
 */
function textoPlano(raw) {
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\|/g, ' | ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(tr|p|div|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\+/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
}

/**
 * @param {string} celda
 */
function parsearAcreditacionNaranjaX(celda) {
  const t = String(celda).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

  if (/inmediata|inmediato|al instante|en el acto/.test(t)) {
    return {
      tipo: 'inmediata',
      plazo: 0,
      label: 'Acreditación inmediata',
    }
  }

  if (/24\s*h/.test(t)) {
    return {
      tipo: 'anticipada',
      plazo: 1,
      label: '24 horas',
    }
  }

  if (/72\s*h/.test(t)) {
    return {
      tipo: 'estandar',
      plazo: 3,
      label: '72 horas',
    }
  }

  if (/dia\s*nx|d[ií]a\s*14/.test(t)) {
    return {
      tipo: 'estandar',
      plazo: null,
      label: 'Día NX (día 14 del mes siguiente)',
    }
  }

  const dias = t.match(/(\d+)\s*d[ií]as?/)
  if (dias) {
    const plazo = Number.parseInt(dias[1], 10)
    return {
      tipo: plazo === 1 ? 'anticipada' : 'estandar',
      plazo,
      label: `${plazo} día${plazo === 1 ? '' : 's'}`,
    }
  }

  return {
    tipo: 'desconocida',
    plazo: null,
    label: null,
  }
}

/**
 * @param {object} parcial
 */
function filaNaranjaX(parcial) {
  const parsed = parseArancelTexto(parcial.arancelTexto)
  if (parsed.arancel === null) return null

  const acreditacion = parsearAcreditacionNaranjaX(parcial.acreditacionTexto)

  return crearComisionCobro({
    entidad: 'naranjax',
    nombreComercial: 'Naranja X',
    producto: parcial.producto,
    canal: parcial.canal,
    medioPago: parcial.medioPago,
    arancel: parsed.arancel,
    arancelEsTope: parsed.arancelEsTope,
    incluyeIva: false,
    ivaAdicional: true,
    acreditacionTipo: acreditacion.tipo,
    acreditacionPlazoHabiles: acreditacion.plazo,
    acreditacionLabel: acreditacion.label,
    condiciones: [CONDICION_IVA, parcial.condiciones].filter(Boolean).join(' '),
    enlace: parcial.enlace,
    metadata: {
      fuenteUrl: parcial.enlace,
      celdaOriginal:
        `${parcial.producto} ${parcial.arancelTexto} ${parcial.acreditacionTexto}`
          .replace(/\s+/g, ' ')
          .trim(),
    },
  })
}

/**
 * @param {string} texto
 * @returns {Array<object>}
 */
export function parsearNaranjaXTerminal(texto) {
  const plano = textoPlano(texto)
  /** @type {Array<object>} */
  const filas = []

  const columnas = [
    { re: /cobro(?:s)?\s+en\s+24\s*h/i, acreditacion: '24 hs' },
    { re: /cobro(?:s)?\s+en\s+72\s*h/i, acreditacion: '72 hs' },
    { re: /d[ií]a\s*nx/i, acreditacion: 'Día NX' },
  ]

  const planes = [
    {
      re: /\|\s*1\s*cuota\s*\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|/i,
      producto: 'Terminal crédito NX 1 cuota',
      medioPago: 'credito',
    },
    {
      re: /\|\s*plan\s*z\s*\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|/i,
      producto: 'Terminal Plan Z',
      medioPago: 'credito_cuotas',
    },
    {
      re: /\|\s*6\s*cuotas\s*\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|/i,
      producto: 'Terminal 6 cuotas',
      medioPago: 'credito_cuotas',
    },
  ]

  // Fallback sin pipes: "1 Cuota 4,40% 4,10% 0%"
  const planosPlanes = [
    {
      re: /1\s*cuota\s+([\d]+(?:[.,]\d+)?)\s*%\s*(?:\([^)]*\))?\s+([\d]+(?:[.,]\d+)?)\s*%\s*(?:\([^)]*\))?\s+([\d]+(?:[.,]\d+)?)\s*%/i,
      producto: 'Terminal crédito NX 1 cuota',
      medioPago: 'credito',
    },
    {
      re: /plan\s*z\s+([\d]+(?:[.,]\d+)?)\s*%\s*(?:\([^)]*\))?\s+([\d]+(?:[.,]\d+)?)\s*%\s*(?:\([^)]*\))?\s+([\d]+(?:[.,]\d+)?)\s*%/i,
      producto: 'Terminal Plan Z',
      medioPago: 'credito_cuotas',
    },
    {
      re: /6\s*cuotas\s+([\d]+(?:[.,]\d+)?)\s*%\s*(?:\([^)]*\))?\s+([\d]+(?:[.,]\d+)?)\s*%\s*(?:\([^)]*\))?\s+([\d]+(?:[.,]\d+)?)\s*%/i,
      producto: 'Terminal 6 cuotas',
      medioPago: 'credito_cuotas',
    },
  ]

  let matched = false
  for (const plan of planes) {
    const m = plano.match(plan.re)
    if (!m) continue
    matched = true
    const celdas = [m[1], m[2], m[3]]
    celdas.forEach((celda, i) => {
      const arancelTexto = String(celda).match(
        /([\d]+(?:[.,]\d+)?)\s*%|sin comisi[oó]n/i,
      )
      if (!arancelTexto) return
      const texto = /sin comisi/i.test(arancelTexto[0]) ? '0%' : arancelTexto[0]
      filas.push(
        filaNaranjaX({
          producto: plan.producto,
          canal: 'pos',
          medioPago: plan.medioPago,
          arancelTexto: `${texto} + IVA`,
          acreditacionTexto: columnas[i].acreditacion,
          condiciones: CONDICION_TERMINAL_ARANCEL,
          enlace: NARANJAX_TERMINAL_URL,
        }),
      )
    })
  }

  if (!matched) {
    for (const plan of planosPlanes) {
      const m = plano.match(plan.re)
      if (!m) continue
      ;[m[1], m[2], m[3]].forEach((pct, i) => {
        filas.push(
          filaNaranjaX({
            producto: plan.producto,
            canal: 'pos',
            medioPago: plan.medioPago,
            arancelTexto: `${pct}% + IVA`,
            acreditacionTexto: columnas[i].acreditacion,
            condiciones: CONDICION_TERMINAL_ARANCEL,
            enlace: NARANJAX_TERMINAL_URL,
          }),
        )
      })
    }
  }

  return filas.filter(Boolean)
}

/**
 * @param {string} texto
 * @param {'qr'|'pos'} canal
 * @param {string} enlace
 * @param {string} prefijoProducto
 */
function parsearTablaMedios(texto, canal, enlace, prefijoProducto) {
  const plano = textoPlano(texto)
  /** @type {Array<object>} */
  const filas = []

  const mapeos = [
    {
      re: /dinero\s+en\s+cuenta\s*\|\s*([^|\n]+)\|\s*([^|\n]+)\|/i,
      producto: `${prefijoProducto} dinero en cuenta`,
      medioPago: 'qr_cuenta',
      flatRe: /dinero\s+en\s+cuenta\s+(inmediata)\s+([\d]+(?:[.,]\d+)?)\s*%/i,
    },
    {
      re: /tarjeta\s+de\s+d[eé]bito\s*\|\s*([^|\n]+)\|\s*([^|\n]+)\|/i,
      producto: `${prefijoProducto} débito`,
      medioPago: 'debito',
      flatRe:
        /tarjeta\s+de\s+d[eé]bito\s+(inmediata)\s+([\d]+(?:[.,]\d+)?)\s*%/i,
    },
    {
      re: /tarjeta\s+de\s+cr[eé]dito\s*\|\s*([^|\n]+)\|\s*([^|\n]+)\|/i,
      producto: `${prefijoProducto} crédito`,
      medioPago: 'credito',
      flatRe:
        /tarjeta\s+de\s+cr[eé]dito\s+(inmediata)\s+([\d]+(?:[.,]\d+)?)\s*%/i,
    },
  ]

  for (const mapa of mapeos) {
    const pipe = plano.match(mapa.re)
    if (pipe) {
      filas.push(
        filaNaranjaX({
          producto: mapa.producto,
          canal,
          medioPago: mapa.medioPago,
          arancelTexto: pipe[2],
          acreditacionTexto: pipe[1],
          condiciones: null,
          enlace,
        }),
      )
      continue
    }

    const flat = plano.match(mapa.flatRe)
    if (flat) {
      filas.push(
        filaNaranjaX({
          producto: mapa.producto,
          canal,
          medioPago: mapa.medioPago,
          arancelTexto: `${flat[2]}% + IVA`,
          acreditacionTexto: flat[1],
          condiciones: null,
          enlace,
        }),
      )
    }
  }

  return filas.filter(Boolean)
}

/**
 * @param {string} texto
 */
export function parsearNaranjaXQr(texto) {
  const filas = parsearTablaMedios(texto, 'qr', NARANJAX_QR_URL, 'QR')

  const plano = textoPlano(texto)
  const tienePromo =
    /0\s*%\s*de\s*comisi[oó]n[\s\S]{0,80}?primeros\s+3\s+meses|primeros\s+3\s+meses[\s\S]{0,120}?0\s*%|sin\s+costo\s+los\s+primeros\s+3\s+meses/i.test(
      plano,
    )

  if (tienePromo) {
    filas.unshift(
      filaNaranjaX({
        producto: 'QR dinero en cuenta (promo 3 meses)',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: '0% + IVA',
        acreditacionTexto: 'Inmediata',
        condiciones: CONDICION_QR_PROMO,
        enlace: NARANJAX_QR_URL,
      }),
    )
  }

  return filas.filter(Boolean)
}

/**
 * @param {string} texto
 */
export function parsearNaranjaXTap(texto) {
  return parsearTablaMedios(texto, 'pos', NARANJAX_TAP_URL, 'TAP')
}

/**
 * @param {{ terminal?: string, qr?: string, tap?: string }} fuentes
 */
export function parsearNaranjaX(fuentes) {
  return [
    ...parsearNaranjaXTerminal(fuentes.terminal || ''),
    ...parsearNaranjaXQr(fuentes.qr || ''),
    ...parsearNaranjaXTap(fuentes.tap || ''),
  ]
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

/**
 * @param {string} url
 * @param {(texto: string) => Array<object>} parser
 */
async function obtenerContenido(url, parser) {
  try {
    const html = await fetchAxios(url)
    if (parser(html).length) return html
    logMensaje(log, 'Naranja X axios sin tasas, pruebo Firecrawl', { url })
  } catch (error) {
    logMensaje(log, 'Naranja X axios falló, pruebo Firecrawl', {
      url,
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, url)
  return scraped.markdown || scraped.html || ''
}

export async function extraerNaranjaX() {
  try {
    const [terminal, qr, tap] = await Promise.all([
      obtenerContenido(NARANJAX_TERMINAL_URL, parsearNaranjaXTerminal),
      obtenerContenido(NARANJAX_QR_URL, parsearNaranjaXQr),
      obtenerContenido(NARANJAX_TAP_URL, parsearNaranjaXTap),
    ])

    const comisiones = parsearNaranjaX({ terminal, qr, tap })

    logMensaje(log, 'Naranja X parseado', {
      filas: comisiones.length,
      terminal: parsearNaranjaXTerminal(terminal).length,
      qr: parsearNaranjaXQr(qr).length,
      tap: parsearNaranjaXTap(tap).length,
    })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
