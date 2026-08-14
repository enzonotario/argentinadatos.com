import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const SIPAGO_COMISIONES_URL = 'https://www.sipago.coop/comisiones'
export const SIPAGO_CUOTAS_URL = 'https://www.sipago.coop/cuotas'

const log = logGrupo({
  fuente: 'extraerSipagoComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_IVA = 'Comisiones expresadas sin IVA.'

const CONDICION_INMEDIATA_CREDICOOP =
  'Acreditación inmediata habilitada solo para comercios con cuenta de acreditación en Banco Credicoop.'

const CONDICION_CUOTAS =
  'Tasa de financiación vigente desde 10/02/2026. Además se descuenta la comisión por servicio según el plazo de pago publicado en /comisiones.'

const CONDICION_ADELANTO =
  'Comisión de adelanto de fondos sobre ventas en cuotas; se suma a la tasa de financiación.'

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
 */
function parsearAcreditacionSipago(texto) {
  const t = String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

  if (/inmediata|inmediato|al instante|en el acto/.test(t)) {
    return {
      tipo: 'inmediata',
      plazo: 0,
      label: 'Acreditación inmediata',
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
function filaSipago(parcial) {
  const arancelTexto = /IVA/i.test(parcial.arancelTexto)
    ? parcial.arancelTexto
    : `${parcial.arancelTexto} + IVA`
  const parsed = parseArancelTexto(arancelTexto)
  if (parsed.arancel === null) return null

  const acreditacion = parsearAcreditacionSipago(
    parcial.acreditacionTexto || '',
  )

  return crearComisionCobro({
    entidad: 'sipago',
    nombreComercial: 'Sipago',
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
    vigenciaDesde: parcial.vigenciaDesde ?? null,
    metadata: {
      fuenteUrl: parcial.enlace,
      celdaOriginal:
        `${parcial.producto} ${parcial.arancelTexto} ${parcial.acreditacionTexto || ''}`
          .replace(/\s+/g, ' ')
          .trim(),
    },
  })
}

/**
 * @param {string} bloque
 * @returns {Array<{ plazo: string, arancel: string }>}
 */
function paresAcreditacionArancel(bloque) {
  /** @type {Array<{ plazo: string, arancel: string }>} */
  const pares = []
  const re =
    /(Acred\.?\s*inmediata\*?|Acreditaci[oó]n\s+(?:inmediata|en\s+\d+\s*d[ií]as?))[\s\S]{0,40}?([\d]+(?:[.,]\d+)?)\s*%/gi

  for (const match of bloque.matchAll(re)) {
    pares.push({
      plazo: match[1].replace(/\*/g, ''),
      arancel: match[2],
    })
  }

  return pares
}

/**
 * @param {string} texto
 */
export function parsearSipagoComisiones(texto) {
  const plano = textoPlano(texto)
  const cuerpo = recortar(
    plano,
    /Tarjetas de cr[eé]dito/i,
    /Ver tasas para ventas en cuotas|Acept[aá] todos|Preguntas frecuentes/i,
  )

  /** @type {Array<object>} */
  const filas = []

  const credito = recortar(
    cuerpo,
    /Tarjetas de cr[eé]dito/i,
    /Tarjetas de d[eé]bito/i,
  )
  for (const par of paresAcreditacionArancel(credito)) {
    const esInmediata = /inmediata/i.test(par.plazo)
    filas.push(
      filaSipago({
        producto: 'Crédito',
        canal: 'pos',
        medioPago: 'credito',
        arancelTexto: `${par.arancel}%`,
        acreditacionTexto: par.plazo,
        condiciones: esInmediata ? CONDICION_INMEDIATA_CREDICOOP : null,
        enlace: SIPAGO_COMISIONES_URL,
      }),
    )
  }

  const debito = recortar(
    cuerpo,
    /Tarjetas de d[eé]bito/i,
    /Tarjetas\s+Prepagas|Dinero en cuenta/i,
  )
  for (const par of paresAcreditacionArancel(debito)) {
    filas.push(
      filaSipago({
        producto: 'Débito',
        canal: 'pos',
        medioPago: 'debito',
        arancelTexto: `${par.arancel}%`,
        acreditacionTexto: par.plazo,
        condiciones: null,
        enlace: SIPAGO_COMISIONES_URL,
      }),
    )
  }

  const prepaga = recortar(cuerpo, /Tarjetas\s+Prepagas/i, /Dinero en cuenta/i)
  for (const par of paresAcreditacionArancel(prepaga)) {
    filas.push(
      filaSipago({
        producto: 'Prepaga',
        canal: 'pos',
        medioPago: 'prepaga',
        arancelTexto: `${par.arancel}%`,
        acreditacionTexto: par.plazo,
        condiciones: null,
        enlace: SIPAGO_COMISIONES_URL,
      }),
    )
  }

  const cuenta = recortar(cuerpo, /Dinero en cuenta/i, null)
  for (const par of paresAcreditacionArancel(cuenta)) {
    filas.push(
      filaSipago({
        producto: 'QR dinero en cuenta',
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancelTexto: `${par.arancel}%`,
        acreditacionTexto: par.plazo,
        condiciones: null,
        enlace: SIPAGO_COMISIONES_URL,
      }),
    )
  }

  return filas.filter(Boolean)
}

/**
 * @param {string} bloque
 * @param {(cuotas: number, arancel: string) => object|null} mapear
 */
function parsearFilasCuotas(bloque, mapear) {
  /** @type {Array<object>} */
  const filas = []
  const re =
    /(?:Plan\s+Cuota\s+Sipago\s+(\d+)|(\d+)\s*cuotas?|Tarjeta de cr[eé]dito\s+(\d+)\s*pagos)[\s\S]{0,40}?([\d]+(?:[.,]\d+)?)\s*%/gi

  for (const match of bloque.matchAll(re)) {
    const cuotas = Number.parseInt(match[1] || match[2] || match[3], 10)
    const fila = mapear(cuotas, match[4])
    if (fila) filas.push(fila)
  }

  return filas
}

/**
 * @param {string} texto
 */
export function parsearSipagoCuotas(texto) {
  const plano = textoPlano(texto)
  /** @type {Array<object>} */
  const filas = []

  const visa = recortar(
    plano,
    /Tasas para Cabal,\s*Visa,\s*Mastercard/i,
    /Tasas para American Express|Comisi[oó]n Adelanto/i,
  )
  filas.push(
    ...parsearFilasCuotas(visa, (cuotas, arancel) =>
      filaSipago({
        producto: `Cuotas Visa/MC/Cabal ${cuotas}`,
        canal: 'pos',
        medioPago: 'credito_cuotas',
        arancelTexto: `${arancel}% + IVA`,
        acreditacionTexto: '',
        condiciones: CONDICION_CUOTAS,
        enlace: SIPAGO_CUOTAS_URL,
        vigenciaDesde: '2026-02-10',
      }),
    ),
  )

  const amex = recortar(
    plano,
    /Tasas para American Express y Naranja/i,
    /Comisi[oó]n Adelanto|Medio de pago/i,
  )
  filas.push(
    ...parsearFilasCuotas(amex, (cuotas, arancel) =>
      filaSipago({
        producto: `Cuotas Amex/Naranja ${cuotas}`,
        canal: 'pos',
        medioPago: 'credito_cuotas',
        arancelTexto: `${arancel}% + IVA`,
        acreditacionTexto: '',
        condiciones: CONDICION_CUOTAS,
        enlace: SIPAGO_CUOTAS_URL,
        vigenciaDesde: '2026-02-10',
      }),
    ),
  )

  const adelanto = recortar(
    plano,
    /Comisi[oó]n Adelanto Fondos/i,
    /Tasas de financiaci[oó]n vigentes|Acept[aá] todos|Preguntas frecuentes/i,
  )
  filas.push(
    ...parsearFilasCuotas(adelanto, (cuotas, arancel) =>
      filaSipago({
        producto: `Adelanto fondos ${cuotas} pagos`,
        canal: 'pos',
        medioPago: 'credito_cuotas',
        arancelTexto: `${arancel}% + IVA`,
        acreditacionTexto: '',
        condiciones: CONDICION_ADELANTO,
        enlace: SIPAGO_CUOTAS_URL,
        vigenciaDesde: '2026-02-10',
      }),
    ),
  )

  return filas.filter(Boolean)
}

/**
 * @param {{ comisiones?: string, cuotas?: string }} fuentes
 */
export function parsearSipago(fuentes) {
  return [
    ...parsearSipagoComisiones(fuentes.comisiones || ''),
    ...parsearSipagoCuotas(fuentes.cuotas || ''),
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
    logMensaje(log, 'Sipago axios sin tasas, pruebo Firecrawl', { url })
  } catch (error) {
    logMensaje(log, 'Sipago axios falló, pruebo Firecrawl', {
      url,
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, url)
  return scraped.markdown || scraped.html || ''
}

export async function extraerSipago() {
  try {
    const [comisionesHtml, cuotasHtml] = await Promise.all([
      obtenerContenido(SIPAGO_COMISIONES_URL, parsearSipagoComisiones),
      obtenerContenido(SIPAGO_CUOTAS_URL, parsearSipagoCuotas),
    ])

    const comisiones = parsearSipago({
      comisiones: comisionesHtml,
      cuotas: cuotasHtml,
    })

    logMensaje(log, 'Sipago parseado', {
      filas: comisiones.length,
      comisiones: parsearSipagoComisiones(comisionesHtml).length,
      cuotas: parsearSipagoCuotas(cuotasHtml).length,
    })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
