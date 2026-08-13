import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const MASPAGOS_SIMULADOR_URL =
  'https://maspagos.com.ar/simulador-de-ventas'
export const MASPAGOS_COMISIONES_URL = 'https://maspagos.com.ar/comisiones'

const MASPAGOS_URLS = [MASPAGOS_SIMULADOR_URL, MASPAGOS_COMISIONES_URL]

const log = logGrupo({
  fuente: 'extraerMaspagosComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_IVA = 'Comisiones de referencia; no incluyen IVA.'

const CONDICION_PROMO =
  'Primeros tres meses bonificados en ventas con transferencia.'

const CONDICION_POS_QR_TAP = 'Aplica a Smart POS, código QR y Tap to Phone.'

/**
 * @param {string} raw
 * @returns {string}
 */
function textoPlano(raw) {
  return String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
 * @param {string} contexto
 */
function parsearAcreditacionMaspagos(contexto) {
  const t = String(contexto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/inmediata|en el acto|al instante/.test(t)) {
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
 */
function textoArancel(texto) {
  const t = String(texto).trim()
  return /%/.test(t) ? t : `${t}%`
}

/**
 * @param {object} parcial
 */
function filaMaspagos(parcial) {
  const parsed = parseArancelTexto(
    `${textoArancel(parcial.arancelTexto)} + IVA`,
  )
  if (parsed.arancel === null) return null

  const acreditacion = parsearAcreditacionMaspagos(parcial.contexto)

  return crearComisionCobro({
    entidad: 'maspagos',
    nombreComercial: '+Pagos Nación',
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
    enlace: MASPAGOS_SIMULADOR_URL,
    metadata: {
      fuenteUrl: MASPAGOS_SIMULADOR_URL,
      celdaOriginal: `${parcial.arancelTexto} ${parcial.contexto}`
        .replace(/\s+/g, ' ')
        .trim(),
    },
  })
}

function claveFila(fila) {
  return [
    fila.producto,
    fila.canal,
    fila.medioPago,
    fila.arancel,
    fila.acreditacionPlazoHabiles,
  ].join('|')
}

/**
 * @param {string} texto
 * @param {RegExp} re
 */
function ultimoIndice(texto, re) {
  let last = -1
  const r = new RegExp(re.source, 'gi')
  let match
  while ((match = r.exec(texto)) !== null) last = match.index
  return last
}

/**
 * @param {string} antes
 */
function clasificarDebito(antes) {
  const candidatos = [
    {
      i: ultimoIndice(antes, /link\s+de\s+pago/),
      canal: 'link',
      producto: 'Débito link de pago',
    },
    {
      i: ultimoIndice(antes, /smart\s+pos/),
      canal: 'pos',
      producto: 'Débito Smart POS / Tap to Phone',
    },
    {
      i: ultimoIndice(antes, /cobr[aá] con qr|\bqr\b/),
      canal: 'qr',
      producto: 'Débito QR',
    },
  ]
    .filter(c => c.i >= 0)
    .sort((a, b) => b.i - a.i)

  if (!candidatos.length) {
    return {
      canal: 'pos',
      producto: 'Débito Smart POS / Tap to Phone',
    }
  }

  return candidatos[0]
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearMaspagos(html) {
  const texto = textoPlano(html)
  const cuerpoMatch = texto.search(/Simul[aá] tu cobro/i)
  const cuerpo = cuerpoMatch > 0 ? texto.slice(0, cuerpoMatch) : texto

  const transferencia = recortar(
    cuerpo,
    /Ventas con transferencia/i,
    /Ventas con tarjeta de cr[eé]dito/i,
  )
  const credito = recortar(
    cuerpo,
    /Ventas con tarjeta de cr[eé]dito/i,
    /Ventas con tarjeta de d[eé]bito/i,
  )
  const debito = recortar(
    cuerpo,
    /Ventas con tarjeta de d[eé]bito/i,
    /Simul[aá] tu cobro/i,
  )

  /** @type {Array<object>} */
  const crudas = []

  const promo = transferencia.match(
    /Primeros tres\s+meses bonificados[\s\S]{0,80}?([\d]+(?:[.,]\d+)?)\s*%/i,
  )
  if (promo) {
    crudas.push(
      filaMaspagos({
        producto: 'QR transferencia (promo)',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: promo[1],
        contexto: 'Acreditación inmediata',
        condiciones: CONDICION_PROMO,
      }),
    )
  }

  const qrCta = transferencia.match(
    /Con c[oó]digo QR[\s\S]{0,80}?([\d]+(?:[.,]\d+)?)\s*%/i,
  )
  if (qrCta) {
    crudas.push(
      filaMaspagos({
        producto: 'QR transferencia',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: qrCta[1],
        contexto: 'Acreditación inmediata',
        condiciones: null,
      }),
    )
  }

  for (const match of credito.matchAll(
    /(\d+)\s*d[ií]as?\s*h[aá]biles[\s\S]{0,80}?([\d]+(?:[.,]\d+)?)\s*%/gi,
  )) {
    const plazo = Number.parseInt(match[1], 10)
    const antes = credito.slice(Math.max(0, match.index - 80), match.index)
    const esFast = /cobr[aá] antes|2\s*d[ií]as/i.test(match[0]) && plazo === 2

    crudas.push(
      filaMaspagos({
        producto: esFast ? 'Crédito Fast Pay' : 'Crédito Smart POS / QR / Tap',
        canal: 'pos',
        medioPago: 'credito',
        arancelTexto: match[2],
        contexto: `${plazo} días hábiles ${antes}`,
        condiciones: esFast ? null : CONDICION_POS_QR_TAP,
      }),
    )
  }

  const linkCredito = credito.match(
    /link de pago es del\s+([\d]+(?:[.,]\d+)?)\s*%[^.]{0,80}?(\d+)\s*d[ií]as?\s*h[aá]biles/i,
  )
  if (linkCredito) {
    crudas.push(
      filaMaspagos({
        producto: 'Crédito link de pago',
        canal: 'link',
        medioPago: 'credito',
        arancelTexto: linkCredito[1],
        contexto: `${linkCredito[2]} días hábiles`,
        condiciones: null,
      }),
    )
  }

  for (const match of debito.matchAll(
    /([\d]+(?:[.,]\d+)?)\s*%[^%]{0,140}?24\s*h/gi,
  )) {
    const { canal, producto } = clasificarDebito(debito.slice(0, match.index))

    crudas.push(
      filaMaspagos({
        producto,
        canal,
        medioPago: 'debito',
        arancelTexto: match[1],
        contexto: '24 h',
        condiciones: null,
      }),
    )
  }

  const vistas = new Set()
  /** @type {Array<object>} */
  const comisiones = []
  for (const fila of crudas) {
    if (!fila) continue
    const clave = claveFila(fila)
    if (vistas.has(clave)) continue
    vistas.add(clave)
    comisiones.push(fila)
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

async function obtenerHtml(url) {
  try {
    const html = await fetchAxios(url)
    if (parsearMaspagos(html).length) return html
    logMensaje(log, '+Pagos axios sin cards, pruebo Firecrawl', { url })
  } catch (error) {
    logMensaje(log, '+Pagos axios falló, pruebo Firecrawl', {
      url,
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, url)
  return scraped.html || scraped.markdown || ''
}

export async function extraerMaspagos() {
  try {
    for (const url of MASPAGOS_URLS) {
      const html = await obtenerHtml(url)
      const comisiones = parsearMaspagos(html)
      if (comisiones.length) {
        logMensaje(log, '+Pagos Nación parseado', {
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

    logMensaje(log, '+Pagos Nación sin filas parseables')
    return []
  } catch (error) {
    logError(log, error)
    return []
  }
}
