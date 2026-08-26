import axios from 'axios'
import { load } from 'cheerio'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const BULL_HELP_URL = 'https://help.bullmarketbrokers.com/'
export const BULL_MEDIA_API_URL =
  'https://help.bullmarketbrokers.com/wp-json/wp/v2/media'
export const BULL_PDF_FALLBACK_URL =
  'https://help.bullmarketbrokers.com/wp-content/uploads/2025/11/Agosto-2025.pdf'

const log = logGrupo({
  fuente: 'extraerBullMarketComisionesBrokers',
  tipo: 'extraccion',
})

const DERECHO_MERCADO_DEFAULT = porcentajeADecimal(0.045, 6)

/**
 * @param {string} html
 * @returns {string|null}
 */
export function resolverUrlPdfBull(html) {
  const $ = load(html)
  /** @type {Array<{ href: string, text: string }>} */
  const candidatos = []

  $('a[href*=".pdf"]').each((_, a) => {
    const href = $(a).attr('href')
    if (!href) return
    const text = $(a).text().replace(/\s+/g, ' ').trim()
    candidatos.push({ href, text })
  })

  const preferido =
    candidatos.find((c) =>
      /comisi[oó]n|arancel|cauci|agosto|tarif/i.test(`${c.text} ${c.href}`),
    ) || candidatos[0]

  if (!preferido) return null

  try {
    return new URL(preferido.href, BULL_HELP_URL).toString()
  } catch {
    return preferido.href
  }
}

/**
 * @param {Array<object>} media
 * @returns {string|null}
 */
export function resolverUrlPdfDesdeMedia(media) {
  if (!Array.isArray(media)) return null

  const pdfs = media.filter(
    (item) =>
      item?.mime_type === 'application/pdf' ||
      /\.pdf$/i.test(item?.source_url || ''),
  )

  const preferido =
    pdfs.find((item) =>
      /comisi|arancel|agosto|cauci|tarif/i.test(
        `${item?.title?.rendered || ''} ${item?.source_url || ''}`,
      ),
    ) || pdfs[0]

  return preferido?.source_url || null
}

/**
 * @param {string} plano
 * @param {RegExp} labelRe
 * @returns {{ tasaTexto: string|null, minimo: number|null, derecho: number|null }}
 */
function extraerFilaPorEtiqueta(plano, labelRe) {
  const m = plano.match(labelRe)
  if (!m) {
    return { tasaTexto: null, minimo: null, derecho: null }
  }

  const ventana = plano.slice(m.index, m.index + 220)
  const tasaMatch = ventana.match(/([\d]+(?:[.,]\d+)?)\s*%\s*(mensual|anual)?/i)
  const minimo = parseComisionMinimaTexto(ventana)

  let derecho = null
  if (/0[,.]045\s*%/.test(ventana)) {
    derecho = porcentajeADecimal(0.045, 6)
  } else {
    const derechoMatch = ventana.match(
      /([\d]+(?:[.,]\d+)?)\s*%\s*(?:\(9\)|\/\s*1%\s*anual)/i,
    )
    if (derechoMatch) {
      derecho = parseTasaComisionTexto(`${derechoMatch[1]}%`).tasa
    } else {
      const porcentajes = [
        ...ventana.matchAll(/([\d]+(?:[.,]\d+)?)\s*%/g),
      ].map((x) => x[1])
      if (porcentajes.length >= 2) {
        derecho = parseTasaComisionTexto(
          `${porcentajes[porcentajes.length - 1]}%`,
        ).tasa
      }
    }
  }

  return {
    tasaTexto: tasaMatch
      ? `${tasaMatch[1]}%${tasaMatch[2] ? ` ${tasaMatch[2]}` : ''}`
      : null,
    minimo,
    derecho,
  }
}

/**
 * Cauciones, alquiler de títulos, cheques y licitaciones del PDF.
 * @param {string} texto
 */
export function parsearBullPdfTexto(texto) {
  const plano = String(texto).replace(/\r/g, ' ').replace(/\s+/g, ' ')
  /** @type {Array<object>} */
  const filas = []

  const specs = [
    {
      producto: 'cauciones',
      operacion: 'colocadora',
      labelRe: /Cauci[oó]n\s*[–\-:]?\s*Pase Burs[aá]til:\s*Colocador/i,
      defaultDerecho: DERECHO_MERCADO_DEFAULT,
      defaultMinimo: null,
    },
    {
      producto: 'cauciones',
      operacion: 'tomadora',
      labelRe: /Cauci[oó]n\s*[–\-:]?\s*Pase Burs[aá]til:\s*Tomador/i,
      defaultDerecho: DERECHO_MERCADO_DEFAULT,
      defaultMinimo: 60,
    },
    {
      producto: 'alquiler_titulos',
      operacion: 'colocadora',
      labelRe: /Alquiler de T[ií]tulos:\s*Colocador/i,
      defaultDerecho: porcentajeADecimal(0.02, 6),
      defaultMinimo: 60,
    },
    {
      producto: 'alquiler_titulos',
      operacion: 'tomadora',
      labelRe: /Alquiler de T[ií]tulos:\s*Tomador/i,
      defaultDerecho: porcentajeADecimal(0.02, 6),
      defaultMinimo: 60,
    },
    {
      producto: 'cheques',
      operacion: 'compra',
      labelRe: /Cheque de Pago Diferido:\s*Compra/i,
      defaultDerecho: porcentajeADecimal(0.03, 6),
      defaultMinimo: 100,
    },
    {
      producto: 'cheques',
      operacion: 'venta',
      labelRe: /Cheque de Pago Diferido:\s*Venta/i,
      defaultDerecho: porcentajeADecimal(0.03, 6),
      defaultMinimo: 100,
    },
  ]

  for (const spec of specs) {
    const extraido = extraerFilaPorEtiqueta(plano, spec.labelRe)
    if (!extraido.tasaTexto) continue

    const parsed = parseTasaComisionTexto(extraido.tasaTexto)
    if (parsed.tasa === null) continue

    filas.push(
      crearComisionBroker({
        entidad: 'bullmarket',
        nombreComercial: 'Bull Market Brokers',
        producto: spec.producto,
        operacion: spec.operacion,
        moneda: 'ARS',
        canal: 'web',
        plan: null,
        tasa: parsed.tasa,
        tasaBase: parsed.tasaBaseHint || 'mensual',
        tasaEsTope: false,
        incluyeIva: false,
        ivaAdicional: true,
        prorrateoDias: null,
        comisionMinima: extraido.minimo ?? spec.defaultMinimo,
        derechoMercado: extraido.derecho ?? spec.defaultDerecho,
        enlace: BULL_HELP_URL,
        metadata: {
          fuenteUrl: BULL_PDF_FALLBACK_URL,
          celdaOriginal: `${spec.producto}/${spec.operacion}: ${extraido.tasaTexto}`,
          notas: 'PDF de aranceles Bull Market. Canal retail (sin split de plan).',
        },
      }),
    )
  }

  // Fallback legado: bloque de tasas mensuales en orden si faltan cauciones
  if (!filas.some((f) => f.producto === 'cauciones')) {
    const bloqueMatch = plano.match(
      /Cauci[oó]n\s*[–\-]\s*Pase Burs[aá]til:\s*Colocador[\s\S]{0,900}?0[,.]045\s*%/i,
    )
    const bloque = bloqueMatch ? bloqueMatch[0] : plano
    const tasasMensuales = [
      ...bloque.matchAll(/([\d]+(?:[.,]\d+)?)\s*%\s*mensual/gi),
    ].map((m) => m[1])
    const minimos = [...bloque.matchAll(/\$\s*([\d.]+)/g)].map((m) =>
      Number.parseInt(String(m[1]).replace(/\./g, ''), 10),
    )
    const legado = [
      { operacion: 'colocadora', tasaTexto: tasasMensuales[0], minimo: null },
      {
        operacion: 'tomadora',
        tasaTexto: tasasMensuales[1],
        minimo: minimos.find((n) => n === 60) ?? 60,
      },
    ]
    for (const spec of legado) {
      if (!spec.tasaTexto) continue
      const parsed = parseTasaComisionTexto(`${spec.tasaTexto}% mensual`)
      if (parsed.tasa === null) continue
      filas.push(
        crearComisionBroker({
          entidad: 'bullmarket',
          nombreComercial: 'Bull Market Brokers',
          producto: 'cauciones',
          operacion: spec.operacion,
          moneda: 'ARS',
          canal: 'web',
          tasa: parsed.tasa,
          tasaBase: 'mensual',
          ivaAdicional: true,
          comisionMinima: spec.minimo,
          derechoMercado: DERECHO_MERCADO_DEFAULT,
          enlace: BULL_HELP_URL,
          metadata: {
            fuenteUrl: BULL_PDF_FALLBACK_URL,
            celdaOriginal: `Caución – Pase Bursátil: ${spec.operacion} ${spec.tasaTexto}% mensual`,
            notas: 'Fallback por orden de tasas mensuales en el PDF.',
          },
        }),
      )
    }
  }

  const licitacionSpecs = [
    {
      labelRe: /Licitaci[oó]n en general\s+([\d]+(?:[.,]\d+)?)\s*%/i,
      nota: 'Licitación en general',
    },
    {
      labelRe:
        /Licitaci[oó]n\/Conversi[oó]n de T[ií]tulos P[uú]blicos\s+([\d]+(?:[.,]\d+)?)\s*%/i,
      nota: 'Licitación/Conversión de Títulos Públicos',
    },
    {
      labelRe:
        /Licitaci[oó]n\/Conversi[oó]n de Letras del Tesoro\s+([\d]+(?:[.,]\d+)?)\s*%/i,
      nota: 'Licitación/Conversión de Letras del Tesoro',
    },
  ]

  /** @type {Set<string>} */
  const licitacionesVistas = new Set()
  for (const spec of licitacionSpecs) {
    const m = plano.match(spec.labelRe)
    if (!m) continue
    const parsed = parseTasaComisionTexto(`${m[1]}%`)
    if (parsed.tasa === null) continue
    const key = String(parsed.tasa)
    if (licitacionesVistas.has(key) && licitacionSpecs.indexOf(spec) > 0) {
      // mismas tasas: emitir una sola fila representativa + extras con metadata
    }
    licitacionesVistas.add(`${spec.nota}:${key}`)
    filas.push(
      crearComisionBroker({
        entidad: 'bullmarket',
        nombreComercial: 'Bull Market Brokers',
        producto: 'licitaciones',
        operacion: 'ambas',
        moneda: 'ARS',
        canal: 'web',
        tasa: parsed.tasa,
        tasaBase: null,
        tasaEsTope: false,
        incluyeIva: false,
        ivaAdicional: true,
        enlace: BULL_HELP_URL,
        metadata: {
          fuenteUrl: BULL_PDF_FALLBACK_URL,
          celdaOriginal: `${spec.nota}: ${m[1]}%`,
          notas: spec.nota,
        },
      }),
    )
  }

  // Fallback licitaciones si el PDF vino desordenado: buscar bloque
  if (!filas.some((f) => f.producto === 'licitaciones')) {
    const m = plano.match(
      /Licitaci[oó]n en general[\s\S]{0,120}?([\d]+(?:[.,]\d+)?)\s*%/i,
    )
    if (m) {
      const parsed = parseTasaComisionTexto(`${m[1]}%`)
      if (parsed.tasa !== null) {
        filas.push(
          crearComisionBroker({
            entidad: 'bullmarket',
            nombreComercial: 'Bull Market Brokers',
            producto: 'licitaciones',
            operacion: 'ambas',
            moneda: 'ARS',
            canal: 'web',
            tasa: parsed.tasa,
            ivaAdicional: true,
            enlace: BULL_HELP_URL,
            metadata: {
              fuenteUrl: BULL_PDF_FALLBACK_URL,
              celdaOriginal: `Licitación en general: ${m[1]}%`,
              notas: 'Licitación en general (fallback).',
            },
          }),
        )
      }
    }
  }

  return filas
}

async function descubrirUrlPdf() {
  try {
    const help = await axios.get(BULL_HELP_URL, {
      responseType: 'text',
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const desdeHelp = resolverUrlPdfBull(String(help.data))
    if (desdeHelp) return { url: desdeHelp, origen: 'help' }
  } catch (error) {
    logMensaje(log, 'Bull help page falló', { errorMessage: error.message })
  }

  try {
    const media = await axios.get(BULL_MEDIA_API_URL, {
      params: { search: 'Agosto', per_page: 20 },
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const desdeMedia = resolverUrlPdfDesdeMedia(media.data)
    if (desdeMedia) return { url: desdeMedia, origen: 'wp-json' }
  } catch (error) {
    logMensaje(log, 'Bull media API falló', { errorMessage: error.message })
  }

  return { url: BULL_PDF_FALLBACK_URL, origen: 'fallback' }
}

/**
 * @param {Buffer|Uint8Array} buffer
 * @param {string} [fuenteUrl]
 */
export async function parsearBullPdfBuffer(
  buffer,
  fuenteUrl = BULL_PDF_FALLBACK_URL,
) {
  const data = await pdf(buffer)
  const filas = parsearBullPdfTexto(data.text)
  return filas.map((fila) => ({
    ...fila,
    metadata: {
      ...fila.metadata,
      fuenteUrl,
    },
  }))
}

export async function extraerBullMarket() {
  try {
    const descubierto = await descubrirUrlPdf()
    logMensaje(log, 'Bull PDF resuelto', descubierto)

    const respuesta = await axios.get(descubierto.url, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/pdf,*/*',
      },
    })

    const comisiones = await parsearBullPdfBuffer(
      Buffer.from(respuesta.data),
      descubierto.url,
    )

    logMensaje(log, 'Bull Market parseado', {
      filas: comisiones.length,
      pdfUrl: descubierto.url,
    })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
