import axios from 'axios'
import * as cheerio from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const NAVE_URL =
  'https://www.galicia.ar/empresas/tarjetas-y-cuentas/cuenta-comercio/nave'

const log = logGrupo({
  fuente: 'extraerNaveComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_CANALES =
  'Publicado para Nave (Point, QR, link de pago y tienda online).'

const CONDICION_QR_PROMO =
  '3 meses 100% gratis en cobros QR con dinero en cuenta (hasta 1.000 UVAs/mes); luego 0,8% + IVA.'

const CONDICION_CREDITO_PLAZOS =
  'Plazos según Com. A 7305 BCRA y categoría ARCA. Naranja X y Amex: acreditación inmediata con la comisión de inmediata. Prepaga nacional: 2 días hábiles.'

/**
 * @param {string} texto
 * @returns {number|null}
 */
function parsePlazoNave(texto) {
  const raw = String(texto)
  const habiles = raw.match(/(\d+)\s*d[ií]as?\s*h[aá]biles?/i)
  if (habiles) return Number.parseInt(habiles[1], 10)

  const entreParentesis = raw.match(/\((\d+)\s*d[ií]as?\)/i)
  if (entreParentesis) return Number.parseInt(entreParentesis[1], 10)

  return null
}

/**
 * @param {string} medioTexto
 */
function mapearMedioNave(medioTexto) {
  const texto = String(medioTexto)
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')
    .replace(/\(\d+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = texto.toLowerCase()

  if (/dinero en cuenta/.test(lower)) {
    return {
      producto: 'QR dinero en cuenta',
      canal: 'qr',
      medioPago: 'qr_cuenta',
      internacional: false,
    }
  }

  if (/d[eé]bito/.test(lower) && /internacional/.test(lower)) {
    return {
      producto: 'Débito internacional',
      canal: 'pos',
      medioPago: 'debito',
      internacional: true,
    }
  }

  if (/d[eé]bito/.test(lower)) {
    return {
      producto: 'Débito',
      canal: 'pos',
      medioPago: 'debito',
      internacional: false,
    }
  }

  if (/cr[eé]dito/.test(lower) && /internacional/.test(lower)) {
    return {
      producto: 'Crédito / prepaga internacional',
      canal: 'pos',
      medioPago: 'credito',
      internacional: true,
    }
  }

  if (/cr[eé]dito/.test(lower)) {
    return {
      producto: 'Crédito / prepaga',
      canal: 'pos',
      medioPago: 'credito',
      internacional: false,
    }
  }

  return null
}

/**
 * @param {import('cheerio').CheerioAPI} $
 */
function extraerColumnas($) {
  const cols = {
    medio: [],
    inmediata: [],
    otros: [],
  }

  $('.comparative-table').each((_, table) => {
    const $t = $(table)
    const heading = $t
      .find('.comparative-table__description')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
    const rows = $t
      .find('.comparative-table__row')
      .map((_, row) =>
        $(row)
          .text()
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .get()

    if (/medio de pago/i.test(heading)) cols.medio = rows
    else if (/inmediata/i.test(heading)) cols.inmediata = rows
    else if (/otros plazos/i.test(heading)) cols.otros = rows
  })

  return cols
}

/**
 * @param {object} params
 */
function filaNave({
  producto,
  canal,
  medioPago,
  arancelTexto,
  acreditacionTipo,
  acreditacionPlazoHabiles,
  acreditacionLabel,
  condiciones,
  metadata,
}) {
  const parsed = parseArancelTexto(arancelTexto)
  if (parsed.arancel === null) return null

  return crearComisionCobro({
    entidad: 'nave',
    nombreComercial: 'Nave',
    producto,
    canal,
    medioPago,
    arancel: parsed.arancel,
    arancelEsTope: parsed.arancelEsTope,
    incluyeIva: parsed.incluyeIva,
    ivaAdicional: parsed.ivaAdicional || /\+?\s*IVA/i.test(arancelTexto),
    acreditacionTipo,
    acreditacionPlazoHabiles,
    acreditacionLabel,
    condiciones,
    enlace: NAVE_URL,
    metadata: {
      fuenteUrl: NAVE_URL,
      celdaOriginal: arancelTexto,
      ...metadata,
    },
  })
}

/**
 * @param {object} medio
 * @param {string} celda
 */
function expandirOtrosPlazos(medio, celda) {
  const parsed = parseArancelTexto(celda)
  if (parsed.arancel === null) return []

  const esCreditoCuotas =
    medio.medioPago === 'credito' &&
    !medio.internacional &&
    /18\s*d[ií]as/i.test(celda) &&
    /7\s*d[ií]as/i.test(celda)

  if (!esCreditoCuotas) {
    const plazo = parsePlazoNave(celda)
    const tipo =
      plazo === 1 ? 'anticipada' : plazo == null ? 'estandar' : 'estandar'
    const label =
      plazo === 1
        ? '1 día hábil'
        : plazo != null
          ? `${plazo} días hábiles`
          : 'En otros plazos'

    return [
      {
        producto: medio.producto,
        medioPago: medio.medioPago,
        canal: medio.canal,
        arancelTexto: celda,
        acreditacionTipo: tipo,
        acreditacionPlazoHabiles: plazo,
        acreditacionLabel: label,
        condiciones: CONDICION_CANALES,
      },
    ]
  }

  return [
    {
      producto: 'Crédito 1 pago',
      medioPago: 'credito',
      canal: medio.canal,
      arancelTexto: celda,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 18,
      acreditacionLabel: 'Hasta 18 días hábiles (1 pago)',
      condiciones: `${CONDICION_CANALES} ${CONDICION_CREDITO_PLAZOS} También aplica a prepagas.`,
    },
    {
      producto: 'Crédito 3 y 6 cuotas',
      medioPago: 'credito_cuotas',
      canal: medio.canal,
      arancelTexto: celda,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 7,
      acreditacionLabel: 'Hasta 7 días hábiles (3 y 6 cuotas)',
      condiciones: `${CONDICION_CANALES} ${CONDICION_CREDITO_PLAZOS}`,
    },
    {
      producto: 'Crédito 7 o más cuotas',
      medioPago: 'credito_cuotas',
      canal: medio.canal,
      arancelTexto: celda,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 2,
      acreditacionLabel: '2 días hábiles (7 o más cuotas)',
      condiciones: `${CONDICION_CANALES} ${CONDICION_CREDITO_PLAZOS}`,
    },
  ]
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearNave(html) {
  const $ = cheerio.load(String(html))
  const cols = extraerColumnas($)
  const n = Math.min(
    cols.medio.length,
    cols.inmediata.length,
    cols.otros.length,
  )

  if (n === 0) return []

  /** @type {Array<object>} */
  const comisiones = []

  for (let i = 0; i < n; i += 1) {
    const medio = mapearMedioNave(cols.medio[i])
    if (!medio) continue

    const inmediata = filaNave({
      producto: medio.producto,
      canal: medio.canal,
      medioPago: medio.medioPago,
      arancelTexto: cols.inmediata[i],
      acreditacionTipo: 'inmediata',
      acreditacionPlazoHabiles: 0,
      acreditacionLabel: 'Acreditación inmediata',
      condiciones: [
        CONDICION_CANALES,
        medio.medioPago === 'qr_cuenta' ? CONDICION_QR_PROMO : null,
        medio.medioPago === 'credito' ? 'También aplica a prepagas.' : null,
      ]
        .filter(Boolean)
        .join(' '),
      metadata: medio.internacional ? { internacional: true } : {},
    })
    if (inmediata) comisiones.push(inmediata)

    for (const extra of expandirOtrosPlazos(medio, cols.otros[i])) {
      const fila = filaNave({
        ...extra,
        metadata: medio.internacional ? { internacional: true } : {},
      })
      if (fila) comisiones.push(fila)
    }
  }

  return comisiones
}

async function fetchAxios() {
  const respuesta = await axios.get(NAVE_URL, {
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
    if (parsearNave(html).length) return html
    logMensaje(log, 'Nave axios sin tabla, pruebo Firecrawl')
  } catch (error) {
    logMensaje(log, 'Nave axios falló, pruebo Firecrawl', {
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, NAVE_URL)
  return scraped.html || scraped.markdown || ''
}

export async function extraerNave() {
  try {
    const html = await obtenerHtml()
    const comisiones = parsearNave(html)

    logMensaje(log, 'Nave parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
