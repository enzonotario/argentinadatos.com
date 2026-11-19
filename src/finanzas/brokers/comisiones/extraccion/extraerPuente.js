import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const PUENTE_HOME_URL = 'https://www.puentenet.com/'
export const PUENTE_PDF_FALLBACK_URL =
  'https://www.puentenet.com/repo/arch/tabla-aranceles-puente-2026-v2.pdf'

const log = logGrupo({
  fuente: 'extraerPuenteComisionesBrokers',
  tipo: 'extraccion',
})

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

/** Tolerancia vertical (pt) para agrupar fragmentos de una misma fila de tasas. */
const TOLERANCIA_FILA = 3
/** Distancia vertical máxima (pt) entre un fragmento de concepto y su fila de tasas. */
const DISTANCIA_MAXIMA_ETIQUETA = 10

/**
 * Columnas del PDF por coordenada X (pt):
 * Concepto | INTERNET MÁXIMO | TELEFÓNICO MÁXIMO | MÍNIMO.
 */
const COLUMNAS = {
  etiqueta: [0, 170],
  internet: [170, 290],
  telefonico: [290, 400],
  minimo: [400, Infinity],
}

/**
 * Filas de "Operaciones Bursátiles". `labelRe` se evalúa sobre el concepto completo
 * (con espacios normalizados). El orden importa: ante claves repetidas gana la primera.
 * @type {Array<{ labelRe: RegExp, producto?: string, productos?: string[], operacion?: string, moneda?: string, exterior?: boolean }>}
 */
const FILAS_PUENTE = [
  {
    labelRe: /^Acciones - Compra\s*\/\s*Venta/i,
    producto: 'acciones',
    moneda: 'ARS',
  },
  {
    labelRe: /^Acciones del Exterior e ETFs/i,
    producto: 'acciones',
    moneda: 'USD',
    exterior: true,
  },
  {
    labelRe: /^Bonos Internacionales Soberanos/i,
    producto: 'bonos',
    moneda: 'USD',
    exterior: true,
  },
  {
    labelRe: /^Bonos Internacionales Corporativos/i,
    producto: 'obligaciones_negociables',
    moneda: 'USD',
    exterior: true,
  },
  {
    labelRe: /^Bonos Soberanos y Corporativos - Compra\s*\/\s*Venta\s+u\$s/i,
    productos: ['bonos', 'obligaciones_negociables'],
    moneda: 'USD',
  },
  {
    labelRe: /^Bonos Soberanos y Corporativos - Compra\s*\/\s*Venta$/i,
    productos: ['bonos', 'obligaciones_negociables'],
    moneda: 'ARS',
  },
  {
    labelRe: /^Cauciones Colocadoras \$/i,
    producto: 'cauciones',
    operacion: 'colocadora',
    moneda: 'ARS',
  },
  {
    labelRe: /^Cauciones Colocadoras U\$S/i,
    producto: 'cauciones',
    operacion: 'colocadora',
    moneda: 'USD',
  },
  {
    labelRe: /^Cauciones Tomadoras \$/i,
    producto: 'cauciones',
    operacion: 'tomadora',
    moneda: 'ARS',
  },
  {
    labelRe: /^Cauciones Tomadoras U\$S/i,
    producto: 'cauciones',
    operacion: 'tomadora',
    moneda: 'USD',
  },
  {
    labelRe: /^Cheques de Pago Diferido/i,
    producto: 'cheques',
    moneda: 'ARS',
  },
  {
    labelRe: /^Fondos Comunes de Inversi[oó]n Internacional/i,
    producto: 'fci',
    moneda: 'USD',
    exterior: true,
  },
  {
    labelRe: /^Futuros - Compra\s*\/\s*Venta/i,
    producto: 'futuros',
    moneda: 'ARS',
  },
  {
    labelRe: /^Licitaciones \/ Suscripciones/i,
    producto: 'licitaciones',
    moneda: 'ARS',
  },
  {
    labelRe: /^Suscripciones Primarias locales/i,
    producto: 'licitaciones',
    moneda: 'ARS',
  },
  {
    labelRe: /^Licitaci[oó]n \/ Compra\s*\/\s*Venta de Letras/i,
    producto: 'letras',
    moneda: 'ARS',
  },
  {
    labelRe: /^Notas BCRA \/ Tesoro Nacional - u\$s/i,
    producto: 'letras',
    moneda: 'USD',
  },
  {
    labelRe: /^Opciones - Compra\s*\/\s*Venta/i,
    producto: 'opciones',
    moneda: 'ARS',
  },
  {
    labelRe: /^Pr[eé]stamos de Valores - Colocador/i,
    producto: 'alquiler_titulos',
    operacion: 'colocadora',
    moneda: 'ARS',
  },
  {
    labelRe: /^Pr[eé]stamos de Valores - Tomador/i,
    producto: 'alquiler_titulos',
    operacion: 'tomadora',
    moneda: 'ARS',
  },
]

/**
 * Busca el link al PDF de aranceles en la home de Puente.
 * @param {string} html
 * @returns {string|null}
 */
export function resolverUrlPdfPuente(html) {
  const m = String(html).match(/href=["']([^"']*tabla-aranceles[^"']*\.pdf)["']/i)
  if (!m) return null
  try {
    return new URL(m[1], PUENTE_HOME_URL).toString()
  } catch {
    return null
  }
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<Array<{ pagina: number, x: number, y: number, texto: string }>>}
 */
export async function extraerItemsPdfPuente(buffer) {
  /** @type {Array<{ pagina: number, x: number, y: number, texto: string }>} */
  const items = []
  let pagina = 0

  await pdf(buffer, {
    pagerender: async pag => {
      pagina += 1
      const actual = pagina
      const contenido = await pag.getTextContent()
      for (const item of contenido.items) {
        const texto = String(item.str || '').trim()
        if (!texto) continue
        items.push({
          pagina: actual,
          x: item.transform[4],
          y: item.transform[5],
          texto,
        })
      }
      return ''
    },
  })

  return items
}

const unir = lista =>
  lista
    .map(i => i.texto)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

const enColumna = ([min, max]) => i => i.x >= min && i.x < max

/**
 * Reconstruye las filas de "Operaciones Bursátiles" (hasta "Acreencias").
 * Las filas se anclan en la columna Internet; los fragmentos del concepto
 * (incluso los partidos en 2 líneas) se asignan a la fila de tasas más cercana.
 * @param {Array<{ pagina: number, x: number, y: number, texto: string }>} items
 */
export function agruparFilasPuente(items) {
  const esEtiqueta = enColumna(COLUMNAS.etiqueta)
  const inicio = items.find(i => esEtiqueta(i) && /^Operaciones/i.test(i.texto))
  const fin = items.find(
    i =>
      esEtiqueta(i) &&
      /^Acreencias$/i.test(i.texto) &&
      (!inicio || i.pagina > inicio.pagina || i.y < inicio.y),
  )

  const seccion = items.filter(i => {
    if (inicio && (i.pagina < inicio.pagina || (i.pagina === inicio.pagina && i.y >= inicio.y))) {
      return false
    }
    if (fin && (i.pagina > fin.pagina || (i.pagina === fin.pagina && i.y <= fin.y))) {
      return false
    }
    return true
  })

  /** @type {Array<{ pagina: number, y: number, items: typeof items, etiquetas: typeof items }>} */
  const filas = []

  const internet = seccion
    .filter(enColumna(COLUMNAS.internet))
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x)

  for (const item of internet) {
    const ultima = filas[filas.length - 1]
    if (
      ultima &&
      ultima.pagina === item.pagina &&
      Math.abs(ultima.y - item.y) <= TOLERANCIA_FILA
    ) {
      ultima.items.push(item)
    } else {
      filas.push({ pagina: item.pagina, y: item.y, items: [item], etiquetas: [] })
    }
  }

  for (const item of seccion.filter(esEtiqueta)) {
    const cercana = filas
      .filter(f => f.pagina === item.pagina)
      .map(f => ({ f, d: Math.abs(f.y - item.y) }))
      .filter(({ d }) => d <= DISTANCIA_MAXIMA_ETIQUETA)
      .sort((a, b) => a.d - b.d)[0]
    if (cercana) cercana.f.etiquetas.push(item)
  }

  const cercanos = (fila, columna) =>
    unir(
      seccion
        .filter(enColumna(columna))
        .filter(i => i.pagina === fila.pagina && Math.abs(i.y - fila.y) <= TOLERANCIA_FILA)
        .sort((a, b) => a.x - b.x),
    )

  return filas
    .map(fila => ({
      y: fila.y,
      etiqueta: unir(
        [...fila.etiquetas].sort((a, b) =>
          Math.abs(a.y - b.y) > TOLERANCIA_FILA ? b.y - a.y : a.x - b.x,
        ),
      ),
      internet: unir([...fila.items].sort((a, b) => a.x - b.x)),
      telefonico: cercanos(fila, COLUMNAS.telefonico),
      minimo: cercanos(fila, COLUMNAS.minimo),
    }))
    .filter(f => f.etiqueta)
}

/**
 * Mínimo de la columna Internet. Devuelve el monto y su moneda.
 * Ej: "Internet u$s 10,00*+IVA / Tel. u$s 20,00*+IVA" → { monto: 10, moneda: 'USD' }.
 * @param {string} texto
 */
export function minimoInternetPuente(texto) {
  if (!texto) return null
  const parte = String(texto).split(/\/\s*Tel/i)[0]
  const m = parte.match(/(u\$s|usd|\$)\s*([\d.]+(?:,\d+)?)/i)
  if (!m) return null
  const monto = Number.parseFloat(m[2].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(monto)) return null
  return { monto, moneda: m[1] === '$' ? 'ARS' : 'USD' }
}

/**
 * Derechos de mercado publicados al pie ("Derechos de Mercado ... : Acciones 0,06%; ...").
 * @param {string} texto
 */
function derechosMercado(texto) {
  const plano = String(texto).replace(/\s+/g, ' ')
  const m = plano.match(/Derechos de Mercado[^:]*:(.*?)(?:Derechos de Bolsa|$)/i)
  if (!m) return {}
  const tramo = m[1]
  const tasa = re => {
    const r = tramo.match(re)
    if (!r) return null
    const n = Number.parseFloat(r[1].replace(',', '.'))
    return Number.isFinite(n) ? porcentajeADecimal(n, 6) : null
  }
  return {
    acciones: tasa(/Acciones\s*([\d]+(?:[.,]\d+)?)\s*%/i),
    bonos: tasa(/T[ií]tulos P[uú]blicos\s*([\d]+(?:[.,]\d+)?)\s*%/i),
    opciones: tasa(/Opciones\s*([\d]+(?:[.,]\d+)?)\s*%/i),
    cauciones: tasa(/Cauciones\s*([\d]+(?:[.,]\d+)?)\s*%/i),
  }
}

/**
 * @param {Array<{ pagina: number, x: number, y: number, texto: string }>} items
 * @param {string} [fuenteUrl]
 */
export function parsearPuenteItems(items, fuenteUrl = PUENTE_PDF_FALLBACK_URL) {
  const filasPdf = agruparFilasPuente(items)
  const derechos = derechosMercado(unir(items))

  /** @type {Array<object>} */
  const comisiones = []
  /** @type {Set<string>} */
  const vistos = new Set()

  for (const spec of FILAS_PUENTE) {
    const fila = filasPdf.find(f => spec.labelRe.test(f.etiqueta))
    if (!fila) continue

    const pct = fila.internet.match(/([\d]+(?:[.,]\d+)?)\s*%/)
    if (!pct) continue
    const parsed = parseTasaComisionTexto(
      /\+\s*IVA/i.test(fila.internet) ? `${pct[1]}% + IVA` : `${pct[1]}%`,
    )
    if (parsed.tasa === null) continue

    const minimo = minimoInternetPuente(fila.minimo)
    const productos = spec.productos || [spec.producto]
    const operacion = spec.operacion || 'ambas'
    const moneda = spec.moneda || 'ARS'

    for (const producto of productos) {
      const clave = `${producto}|${operacion}|${moneda}|${spec.exterior ? 'ext' : 'loc'}`
      if (vistos.has(clave)) continue
      vistos.add(clave)

      let derechoMercado = null
      if (!spec.exterior) {
        if (producto === 'acciones') derechoMercado = derechos.acciones ?? null
        else if (producto === 'bonos' || producto === 'obligaciones_negociables') {
          derechoMercado = derechos.bonos ?? null
        } else if (producto === 'opciones') derechoMercado = derechos.opciones ?? null
        else if (producto === 'cauciones') derechoMercado = derechos.cauciones ?? null
      }

      comisiones.push(
        crearComisionBroker({
          entidad: 'puente',
          nombreComercial: 'Puente',
          producto,
          operacion,
          moneda,
          canal: 'web',
          plan: null,
          tasa: parsed.tasa,
          tasaBase: null,
          tasaEsTope: false,
          incluyeIva: false,
          ivaAdicional: parsed.ivaAdicional,
          comisionMinima: minimo ? minimo.monto : null,
          derechoMercado,
          prorrateoDias: producto === 'cauciones' ? 90 : null,
          enlace: fuenteUrl,
          metadata: {
            fuenteUrl,
            celdaOriginal: [fila.etiqueta, fila.internet, fila.minimo]
              .filter(Boolean)
              .join(' | '),
            ...(minimo ? { comisionMinimaMoneda: minimo.moneda } : {}),
            notas: spec.exterior
              ? 'Columna Internet. Mercado exterior.'
              : 'Columna Internet (retail). Telefónico omitido.',
            ...(spec.exterior ? { mercado: 'exterior' } : {}),
          },
        }),
      )
    }
  }

  return comisiones
}

/**
 * @param {Buffer} buffer
 * @param {string} [fuenteUrl]
 */
export async function parsearPuentePdf(buffer, fuenteUrl) {
  const items = await extraerItemsPdfPuente(buffer)
  return parsearPuenteItems(items, fuenteUrl)
}

async function descubrirUrlPdf() {
  try {
    const respuesta = await axios.get(PUENTE_HOME_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: BROWSER_HEADERS,
    })
    const desdeHome = resolverUrlPdfPuente(String(respuesta.data))
    if (desdeHome) return { url: desdeHome, origen: 'home' }
  } catch (error) {
    logMensaje(log, 'Puente home falló', { errorMessage: error.message })
  }

  return { url: PUENTE_PDF_FALLBACK_URL, origen: 'fallback' }
}

export async function extraerPuente() {
  try {
    const descubierto = await descubrirUrlPdf()
    logMensaje(log, 'Puente PDF resuelto', descubierto)

    const respuesta = await axios.get(descubierto.url, {
      responseType: 'arraybuffer',
      timeout: 45000,
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/pdf,*/*',
        Referer: PUENTE_HOME_URL,
      },
    })

    const comisiones = await parsearPuentePdf(
      Buffer.from(respuesta.data),
      descubierto.url,
    )
    logMensaje(log, 'Puente parseado', {
      filas: comisiones.length,
      pdfUrl: descubierto.url,
    })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
