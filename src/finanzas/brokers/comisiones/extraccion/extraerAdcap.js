import axios from 'axios'
import { load } from 'cheerio'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const ADCAP_LEGALES_URL = 'https://www.ad-cap.com.ar/legales'
export const ADCAP_PDF_FALLBACK_URL =
  'https://cdn.ad-cap.com.ar/adcap-web/pdf/aranceles-y-comisiones.pdf'

const log = logGrupo({
  fuente: 'extraerAdcapComisionesBrokers',
  tipo: 'extraccion',
})

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

/** Tolerancia vertical (pt) para agrupar fragmentos de texto en una misma fila. */
const TOLERANCIA_FILA = 3
/** Distancia vertical máxima (pt) entre la etiqueta del activo y su fila de arancel. */
const DISTANCIA_MAXIMA_ETIQUETA = 20
/** Distancia vertical máxima (pt) para asociar una tasa con su tipo de operación. */
const DISTANCIA_MAXIMA_OPERACION = 8

/**
 * Columnas del PDF por coordenada X (pt). El texto plano del PDF sale desordenado,
 * por eso la tabla se reconstruye con posiciones.
 */
const COLUMNAS = {
  etiqueta: [150, 300],
  operacion: [300, 400],
  moneda: [400, 450],
  tasa: [450, 488],
  base: [488, Infinity],
}

/**
 * Filas de la sección OPERACIONES. `etiquetaRe` se evalúa sobre la etiqueta sin espacios.
 * @type {Array<{
 *   etiquetaRe: RegExp,
 *   operacionRe?: RegExp,
 *   producto: string,
 *   operacion?: string,
 *   moneda?: string,
 * }>}
 */
const FILAS_ADCAP = [
  { etiquetaRe: /^T[ií]tulos/i, producto: 'bonos' },
  {
    etiquetaRe: /^Obligaciones/i,
    operacionRe: /Compra/i,
    producto: 'obligaciones_negociables',
  },
  {
    etiquetaRe: /^Lete/i,
    operacionRe: /Compra/i,
    producto: 'letras',
  },
  { etiquetaRe: /^Acciones/i, producto: 'acciones' },
  { etiquetaRe: /^CEDEAR/i, producto: 'cedears' },
  { etiquetaRe: /^Futuros/i, producto: 'futuros' },
  { etiquetaRe: /^Opciones/i, operacionRe: /Compra/i, producto: 'opciones' },
  {
    etiquetaRe: /^Cauci[oó]n/i,
    operacionRe: /Coloca/i,
    producto: 'cauciones',
    operacion: 'colocadora',
  },
  {
    etiquetaRe: /^Cauci[oó]n/i,
    operacionRe: /Toma/i,
    producto: 'cauciones',
    operacion: 'tomadora',
  },
  {
    etiquetaRe: /^Cheques/i,
    operacionRe: /^Compra$/i,
    producto: 'cheques',
    operacion: 'compra',
  },
  {
    etiquetaRe: /^Cheques/i,
    operacionRe: /^Venta$/i,
    producto: 'cheques',
    operacion: 'venta',
  },
  {
    etiquetaRe: /^Pr[eé]stamos/i,
    operacionRe: /Coloca/i,
    producto: 'alquiler_titulos',
    operacion: 'colocadora',
  },
  {
    etiquetaRe: /^Pr[eé]stamos/i,
    operacionRe: /Toma/i,
    producto: 'alquiler_titulos',
    operacion: 'tomadora',
  },
]

/**
 * @param {string} html
 * @returns {string|null}
 */
export function resolverUrlPdfAdcap(html) {
  const $ = load(html)
  /** @type {Array<{ href: string, text: string }>} */
  const candidatos = []

  $('a[href*=".pdf"]').each((_, a) => {
    const href = $(a).attr('href')
    if (!href) return
    candidatos.push({ href, text: $(a).text().replace(/\s+/g, ' ').trim() })
  })

  const preferido = candidatos.find(c =>
    /arancel|comisi/i.test(`${c.text} ${c.href}`),
  )

  if (!preferido) return null

  try {
    return new URL(preferido.href, ADCAP_LEGALES_URL).toString()
  } catch {
    return preferido.href
  }
}

/**
 * Agrupa los fragmentos de texto del PDF en filas por coordenada Y.
 * @param {Array<{ x: number, y: number, texto: string }>} items
 */
export function agruparFilasAdcap(items) {
  const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  /** @type {Array<{ y: number, items: Array<{ x: number, y: number, texto: string }> }>} */
  const filas = []

  for (const item of ordenados) {
    const ultima = filas[filas.length - 1]
    if (ultima && Math.abs(ultima.y - item.y) <= TOLERANCIA_FILA) {
      ultima.items.push(item)
    } else {
      filas.push({ y: item.y, items: [item] })
    }
  }

  return filas.map(fila => {
    const columna = ([min, max]) =>
      fila.items
        .filter(i => i.x >= min && i.x < max && i.texto !== '(*)')
        .sort((a, b) => a.x - b.x)
        .map(i => i.texto)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

    return {
      y: fila.y,
      etiqueta: columna(COLUMNAS.etiqueta).replace(/\s+/g, ''),
      operacion: columna(COLUMNAS.operacion).replace(/\s+/g, ''),
      operacionTexto: columna(COLUMNAS.operacion),
      moneda: columna(COLUMNAS.moneda),
      tasa: columna(COLUMNAS.tasa),
      base: columna(COLUMNAS.base),
    }
  })
}

function monedaDesdeTexto(texto) {
  const limpio = texto.replace(/\s+/g, '')
  if (limpio === '$') return 'ARS'
  if (limpio === 'U$S') return 'USD'
  return 'ARS'
}

/**
 * @param {ReturnType<typeof agruparFilasAdcap>} filas
 * @param {string} [fuenteUrl]
 */
export function parsearAdcapFilas(filas, fuenteUrl = ADCAP_PDF_FALLBACK_URL) {
  const acreencias = filas.find(f =>
    /ACREENCIA/i.test(f.etiqueta + f.operacion),
  )
  const operaciones = acreencias ? filas.filter(f => f.y > acreencias.y) : filas
  const conOperacion = operaciones.filter(f => f.operacion)
  // La operación y la tasa a veces quedan en Y apenas distintas: se hereda la más cercana.
  const conTasa = operaciones
    .filter(f => /%/.test(f.tasa))
    .map(f => {
      if (f.operacion) return f
      const vecina = conOperacion
        .filter(o => Math.abs(o.y - f.y) <= DISTANCIA_MAXIMA_OPERACION)
        .sort((a, b) => Math.abs(a.y - f.y) - Math.abs(b.y - f.y))[0]
      return vecina
        ? {
            ...f,
            operacion: vecina.operacion,
            operacionTexto: vecina.operacionTexto,
          }
        : f
    })
  /** @type {Array<object>} */
  const comisiones = []

  for (const spec of FILAS_ADCAP) {
    const etiqueta = operaciones.find(f => spec.etiquetaRe.test(f.etiqueta))
    if (!etiqueta) continue

    const candidatas = conTasa
      .filter(f => Math.abs(f.y - etiqueta.y) <= DISTANCIA_MAXIMA_ETIQUETA)
      .filter(f => !spec.operacionRe || spec.operacionRe.test(f.operacion))
      .sort((a, b) => Math.abs(a.y - etiqueta.y) - Math.abs(b.y - etiqueta.y))

    const fila = candidatas[0]
    if (!fila) continue

    const parsed = parseTasaComisionTexto(`${fila.tasa} ${fila.base}`)
    if (parsed.tasa === null) continue

    comisiones.push(
      crearComisionBroker({
        entidad: 'adcap',
        nombreComercial: 'Adcap',
        producto: spec.producto,
        operacion: spec.operacion || 'ambas',
        moneda: spec.moneda || monedaDesdeTexto(fila.moneda),
        canal: 'web',
        plan: null,
        tasa: parsed.tasa,
        tasaBase: parsed.tasaBaseHint,
        tasaEsTope: true,
        incluyeIva: false,
        ivaAdicional: true,
        enlace: ADCAP_LEGALES_URL,
        metadata: {
          fuenteUrl,
          celdaOriginal: [
            etiqueta.etiqueta,
            fila.operacionTexto,
            fila.moneda,
            fila.tasa,
            fila.base,
          ]
            .filter(Boolean)
            .join(' | '),
          notas:
            'Arancel máximo publicado por Adcap. IVA, derechos de mercado y tasas de registro adicionales.',
        },
      }),
    )
  }

  return comisiones
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ x: number, y: number, texto: string }>>}
 */
export async function extraerItemsPdfAdcap(buffer) {
  /** @type {Array<{ x: number, y: number, texto: string }>} */
  const items = []

  await pdf(buffer, {
    pagerender: async pagina => {
      const contenido = await pagina.getTextContent()
      for (const item of contenido.items) {
        const texto = String(item.str || '').trim()
        if (!texto) continue
        items.push({ x: item.transform[4], y: item.transform[5], texto })
      }
      return ''
    },
  })

  return items
}

/**
 * @param {Buffer} buffer
 * @param {string} [fuenteUrl]
 */
export async function parsearAdcapPdf(buffer, fuenteUrl) {
  const items = await extraerItemsPdfAdcap(buffer)
  return parsearAdcapFilas(agruparFilasAdcap(items), fuenteUrl)
}

async function descubrirUrlPdf() {
  try {
    const respuesta = await axios.get(ADCAP_LEGALES_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: BROWSER_HEADERS,
    })
    const desdePagina = resolverUrlPdfAdcap(String(respuesta.data))
    if (desdePagina) return { url: desdePagina, origen: 'legales' }
  } catch (error) {
    logMensaje(log, 'Adcap legales page falló', { errorMessage: error.message })
  }

  return { url: ADCAP_PDF_FALLBACK_URL, origen: 'fallback' }
}

export async function extraerAdcap() {
  try {
    const descubierto = await descubrirUrlPdf()
    logMensaje(log, 'Adcap PDF resuelto', descubierto)

    const respuesta = await axios.get(descubierto.url, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/pdf,*/*',
        Referer: ADCAP_LEGALES_URL,
      },
    })

    const comisiones = await parsearAdcapPdf(
      Buffer.from(respuesta.data),
      descubierto.url,
    )
    logMensaje(log, 'Adcap parseado', {
      filas: comisiones.length,
      pdfUrl: descubierto.url,
    })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
