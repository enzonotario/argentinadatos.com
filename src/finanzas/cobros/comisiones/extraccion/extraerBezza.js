import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const BEZZA_SMARTPOS_URL = 'https://www.bezzapay.com.ar/smartpos'
export const BEZZA_TAP_URL = 'https://www.bezzapay.com.ar/tap-to-phone'
export const BEZZA_QR_URL = 'https://www.bezzapay.com.ar/qr'

const log = logGrupo({
  fuente: 'extraerBezzaComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_IVA = 'Comisiones sin IVA.'

const CONDICION_CREDITOS =
  'Válido para Visa, Mastercard, Cabal y American Express. Los plazos son días hábiles. Naranja X publica comisiones propias distintas.'

const CONDICION_QR =
  '0,8% + IVA para ventas con saldo en cuenta. Si el cliente paga con tarjetas vía billetera/MODO, aplican las comisiones de cada medio.'

const CONDICION_QR_PROMO =
  'Promoción: 0% durante los primeros 3 meses en ventas con código QR y saldo en cuenta.'

const ABRIR_FAQ_ACTIONS = [
  { type: 'wait', milliseconds: 1000 },
  {
    type: 'executeJavascript',
    script:
      'const btn=[...document.querySelectorAll("button")].find(b=>/Plazos y comisiones/i.test(b.textContent||"")); if(btn) btn.click();',
  },
  { type: 'wait', milliseconds: 1500 },
]

/**
 * @param {string} raw
 */
function textoPlano(raw) {
  return String(raw)
    .replace(/\\+/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
}

/**
 * @param {string} texto
 */
function parsearAcreditacionBezza(texto) {
  const t = String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

  if (/en el acto|inmediata|inmediato|al instante/.test(t)) {
    return {
      tipo: 'inmediata',
      plazo: 0,
      label: 'En el acto',
    }
  }

  const dias = t.match(/(\d+)\s*d[ií]as?/)
  if (dias) {
    const plazo = Number.parseInt(dias[1], 10)
    return {
      tipo: plazo === 1 ? 'anticipada' : 'estandar',
      plazo,
      label: `${plazo} día${plazo === 1 ? '' : 's'} hábiles`,
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
function filaBezza(parcial) {
  const parsed = parseArancelTexto(parcial.arancelTexto)
  if (parsed.arancel === null) return null

  const acreditacion = parsearAcreditacionBezza(parcial.acreditacionTexto)

  return crearComisionCobro({
    entidad: 'bezzapay',
    nombreComercial: 'Bezza Pay',
    producto: parcial.producto,
    canal: parcial.canal,
    medioPago: parcial.medioPago,
    arancel: parsed.arancel,
    arancelEsTope: false,
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
 * Extrae pares plazo/% de un bloque "Ventas con...".
 * @param {string} bloque
 * @returns {Array<{ plazo: string, arancel: string }>}
 */
function paresPlazoArancel(bloque) {
  /** @type {Array<{ plazo: string, arancel: string }>} */
  const pares = []
  const re =
    /(En el acto|En \d+\s*d[ií]as?)[\s\S]{0,40}?((?:\d+[.,]\d+|\d+)\s*%(?:\s*\+\s*IVA)?|0,00\s*%)/gi

  for (const match of bloque.matchAll(re)) {
    pares.push({
      plazo: match[1],
      arancel: /0,00/i.test(match[2]) ? '0%' : match[2],
    })
  }

  return pares
}

/**
 * @param {string} texto
 * @param {RegExp} inicio
 * @param {RegExp|null} fin
 */
function recortar(texto, inicio, fin) {
  const start = texto.search(inicio)
  if (start < 0) return ''
  const slice = texto.slice(start)
  if (!fin) return slice
  const end = slice.slice(1).search(fin)
  return end >= 0 ? slice.slice(0, end + 1) : slice
}

/**
 * @param {string} texto
 * @param {{ prefijo: string, canal: string, enlace: string, incluirQr?: boolean }} opts
 */
export function parsearBezzaFaq(texto, opts) {
  const plano = textoPlano(texto)
  /** @type {Array<object>} */
  const filas = []

  const credito = recortar(
    plano,
    /Ventas con tarjeta de cr[eé]dito/i,
    /Ventas con tarjeta de d[eé]bito/i,
  )
  for (const par of paresPlazoArancel(credito)) {
    filas.push(
      filaBezza({
        producto: `${opts.prefijo} crédito`,
        canal: opts.canal,
        medioPago: 'credito',
        arancelTexto: `${par.arancel} + IVA`,
        acreditacionTexto: par.plazo,
        condiciones: CONDICION_CREDITOS,
        enlace: opts.enlace,
      }),
    )
  }

  const debito = recortar(
    plano,
    /Ventas con tarjeta de d[eé]bito/i,
    /Ventas con QR|Primeros|\(1\)|\(2\)/i,
  )
  for (const par of paresPlazoArancel(debito)) {
    filas.push(
      filaBezza({
        producto: `${opts.prefijo} débito`,
        canal: opts.canal,
        medioPago: 'debito',
        arancelTexto: `${par.arancel} + IVA`,
        acreditacionTexto: par.plazo,
        condiciones: null,
        enlace: opts.enlace,
      }),
    )
  }

  if (opts.incluirQr) {
    const qr = recortar(
      plano,
      /Ventas con QR/i,
      /\(1\)|\(2\)|Comisiones v[aá]lidas/i,
    )
    const tienePromo =
      /primeros\s+3\s+meses/i.test(qr) || /primeros\s+3\s+meses/i.test(plano)

    if (tienePromo) {
      filas.push(
        filaBezza({
          producto: `${opts.prefijo} QR (promo 3 meses)`,
          canal: 'qr',
          medioPago: 'qr_cuenta',
          arancelTexto: '0% + IVA',
          acreditacionTexto: 'En el acto',
          condiciones: CONDICION_QR_PROMO,
          enlace: opts.enlace,
        }),
      )
    }

    for (const par of paresPlazoArancel(qr)) {
      filas.push(
        filaBezza({
          producto: `${opts.prefijo} QR`,
          canal: 'qr',
          medioPago: 'qr_cuenta',
          arancelTexto: `${par.arancel} + IVA`,
          acreditacionTexto: par.plazo,
          condiciones: CONDICION_QR,
          enlace: opts.enlace,
        }),
      )
    }
  }

  return filas.filter(Boolean)
}

/**
 * @param {string} texto
 */
export function parsearBezzaSmartpos(texto) {
  return parsearBezzaFaq(texto, {
    prefijo: 'SmartPOS',
    canal: 'pos',
    enlace: BEZZA_SMARTPOS_URL,
    incluirQr: true,
  })
}

/**
 * @param {string} texto
 */
export function parsearBezzaTap(texto) {
  // Misma tabla que SmartPOS; omitimos QR para no duplicar filas del canal QR.
  return parsearBezzaFaq(texto, {
    prefijo: 'TAP',
    canal: 'pos',
    enlace: BEZZA_TAP_URL,
    incluirQr: false,
  })
}

/**
 * @param {string} texto
 */
export function parsearBezzaQr(texto) {
  const plano = textoPlano(texto)
  /** @type {Array<object>} */
  const filas = []

  const tienePromo =
    /primeros\s+3\s+meses\s+sin\s+comisi[oó]n/i.test(plano) ||
    /primeros\s+3\s+meses[\s\S]{0,80}?0\s*%/i.test(plano) ||
    /sin\s+comisi[oó]n[\s\S]{0,40}?3\s+meses/i.test(plano)

  if (tienePromo) {
    filas.push(
      filaBezza({
        producto: 'QR dinero en cuenta (promo 3 meses)',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: '0% + IVA',
        acreditacionTexto: 'En el acto',
        condiciones: CONDICION_QR_PROMO,
        enlace: BEZZA_QR_URL,
      }),
    )
  }

  const regular = plano.match(
    /despu[eé]s\s+de\s+3\s+meses\s+([\d]+(?:[.,]\d+)?)\s*%/i,
  )
  if (regular) {
    filas.push(
      filaBezza({
        producto: 'QR dinero en cuenta',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: `${regular[1]}% + IVA`,
        acreditacionTexto: 'En el acto',
        condiciones: CONDICION_QR,
        enlace: BEZZA_QR_URL,
      }),
    )
  } else if (/0[,.]8\s*%/.test(plano)) {
    filas.push(
      filaBezza({
        producto: 'QR dinero en cuenta',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: '0,8% + IVA',
        acreditacionTexto: 'En el acto',
        condiciones: CONDICION_QR,
        enlace: BEZZA_QR_URL,
      }),
    )
  }

  // Si la landing QR publica tabla completa (crédito/débito), también la sumamos.
  const conTabla = parsearBezzaFaq(plano, {
    prefijo: 'QR',
    canal: 'qr',
    enlace: BEZZA_QR_URL,
    incluirQr: false,
  })

  return [...filas, ...conTabla].filter(Boolean)
}

/**
 * @param {{ smartpos?: string, tap?: string, qr?: string }} fuentes
 */
export function parsearBezza(fuentes) {
  return [
    ...parsearBezzaSmartpos(fuentes.smartpos || ''),
    ...parsearBezzaTap(fuentes.tap || ''),
    ...parsearBezzaQr(fuentes.qr || ''),
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
 * @param {boolean} abrirFaq
 */
async function obtenerContenido(url, parser, abrirFaq) {
  try {
    const html = await fetchAxios(url)
    if (parser(html).length) return html
    logMensaje(log, 'Bezza axios sin tasas, pruebo Firecrawl', { url })
  } catch (error) {
    logMensaje(log, 'Bezza axios falló, pruebo Firecrawl', {
      url,
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(
    log,
    url,
    abrirFaq ? { actions: ABRIR_FAQ_ACTIONS } : {},
  )
  return scraped.markdown || scraped.html || ''
}

export async function extraerBezza() {
  try {
    const [smartpos, tap, qr] = await Promise.all([
      obtenerContenido(BEZZA_SMARTPOS_URL, parsearBezzaSmartpos, true),
      obtenerContenido(BEZZA_TAP_URL, parsearBezzaTap, true),
      obtenerContenido(BEZZA_QR_URL, parsearBezzaQr, false),
    ])

    const comisiones = parsearBezza({ smartpos, tap, qr })

    logMensaje(log, 'Bezza Pay parseado', {
      filas: comisiones.length,
      smartpos: parsearBezzaSmartpos(smartpos).length,
      tap: parsearBezzaTap(tap).length,
      qr: parsearBezzaQr(qr).length,
    })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
