import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const PAGE_URL =
  'https://www.bancochubut.com.ar/webinstitucional/personas/prestamos/todos_los_prestamos/tasa_fija'
const PRODUCT_API =
  'https://www.bancochubut.com.ar/jsonapi/node/productos?filter[field_url][value]=/personas/prestamos/todos_los_prestamos/tasa_fija&include=field_tasas'
const TASAS_API_BASE = 'https://www.bancochubut.com.ar/jsonapi/node/tasas/'

const log = logGrupo({
  fuente: 'extraerChubutPrestamosPersonales',
  tipo: 'extraccion',
})

const axiosJson = axios.create({
  timeout: 20000,
  headers: {
    Accept: 'application/vnd.api+json, application/json',
    'User-Agent':
      'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
  },
})

/**
 * @param {string} htmlTabla
 * @returns {Array<{ descripcion: string, plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>}
 */
export function parsearTablaTasasChubut(htmlTabla) {
  const $ = load(String(htmlTabla))
  /** @type {Array<{ descripcion: string, plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number }>} */
  const filas = []

  $('table tbody tr').each((_, tr) => {
    const celdas = $(tr)
      .find('td')
      .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get()

    // ID | Descripción | desde | hasta | TNA | TEA | TEM | CFT(e) | +info
    if (celdas.length < 8) return

    const descripcion = celdas[1]
    const plazoMinMeses = Number.parseInt(celdas[2], 10)
    const plazoMaxMeses = Number.parseInt(celdas[3], 10)
    const tna = parsePorcentaje(celdas[4])
    const tea = parsePorcentaje(celdas[5])
    const cftTea = parsePorcentaje(celdas[7])

    if (
      !descripcion ||
      !plazoMinMeses ||
      !plazoMaxMeses ||
      tna === null ||
      tea === null ||
      cftTea === null
    ) {
      return
    }

    filas.push({
      descripcion,
      plazoMinMeses,
      plazoMaxMeses,
      tna,
      tea,
      cftTea,
    })
  })

  return filas
}

/**
 * @param {string} texto
 * @returns {string|null}
 */
function parsearVigenciaAl(texto) {
  const m = String(texto).match(
    /Datos v[aá]lidos al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  )
  return m ? parseFechaSlash(m[1]) : null
}

/**
 * @param {string|object} jsonOrHtml
 * @returns {Array<object>}
 */
export function parsearChubut(jsonOrHtml) {
  let htmlTabla = ''
  let textoExtra = ''

  if (typeof jsonOrHtml === 'string') {
    const trimmed = jsonOrHtml.trim()
    if (trimmed.startsWith('{')) {
      try {
        return parsearChubut(JSON.parse(trimmed))
      } catch {
        htmlTabla = trimmed
      }
    } else {
      htmlTabla = trimmed
    }
  } else if (jsonOrHtml && typeof jsonOrHtml === 'object') {
    const data = jsonOrHtml.data
    const nodo = Array.isArray(data) ? data[0] : data
    const attrs = nodo?.attributes || {}
    const field =
      attrs.field_tasa ||
      (jsonOrHtml.included || []).find((inc) => inc.type === 'node--tasas')
        ?.attributes?.field_tasa
    htmlTabla = field?.processed || field?.value || ''
    textoExtra = String(htmlTabla)
  }

  if (!htmlTabla) return []

  const filas = parsearTablaTasasChubut(htmlTabla)
  if (!filas.length) return []

  const vigenciaDesde = parsearVigenciaAl(`${htmlTabla} ${textoExtra}`)

  /** @type {Map<string, typeof filas>} */
  const porProducto = new Map()
  for (const fila of filas) {
    const key = fila.descripcion
    if (!porProducto.has(key)) porProducto.set(key, [])
    porProducto.get(key).push(fila)
  }

  const ofertas = []

  for (const [descripcion, tramosRaw] of porProducto) {
    const tramos = [...tramosRaw].sort(
      (a, b) => a.plazoMinMeses - b.plazoMinMeses,
    )
    const tasasPorPlazo = tramos.map(
      ({ plazoMinMeses, plazoMaxMeses, tna, tea, cftTea }) => ({
        plazoMinMeses,
        plazoMaxMeses,
        tna,
        tea,
        cftTea,
      }),
    )
    const ref = tramos[tramos.length - 1]
    const plazoMinMeses = tasasPorPlazo[0].plazoMinMeses
    const plazoMaxMeses = tasasPorPlazo[tasasPorPlazo.length - 1].plazoMaxMeses

    ofertas.push({
      entidad: 'CHUBUT',
      nombreComercial: 'Banco del Chubut',
      producto: descripcion,
      tna: ref.tna,
      tea: ref.tea,
      cftTna: null,
      cftTea: ref.cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: /descuento de haberes/i.test(descripcion),
      condiciones: /descuento de haberes/i.test(descripcion)
        ? 'Descuento de haberes'
        : 'Tasa fija',
      enlace: PAGE_URL,
      vigenciaDesde,
      vigenciaHasta: null,
      metadata: {
        plazoMesesEjemplo: plazoMaxMeses,
        plazoMinMeses,
        plazoMaxMeses,
        tasasPorPlazo,
      },
    })
  }

  return ofertas
}

/**
 * @param {object} productoJson
 * @returns {string|null}
 */
function resolverIdTasas(productoJson) {
  const included = productoJson.included || []
  const incluido = included.find((inc) => inc.type === 'node--tasas')
  if (incluido?.id) return incluido.id

  const data = Array.isArray(productoJson.data)
    ? productoJson.data[0]
    : productoJson.data
  const rel = data?.relationships?.field_tasas?.data
  if (!rel) return null
  return Array.isArray(rel) ? rel[0]?.id : rel.id
}

export async function extraerChubut() {
  try {
    const productoRes = await axiosJson.get(PRODUCT_API)
    const tasasId = resolverIdTasas(productoRes.data)

    if (!tasasId) {
      logMensaje(log, 'Chubut sin relación field_tasas')
      return []
    }

    const included = (productoRes.data.included || []).find(
      (inc) => inc.type === 'node--tasas' && inc.id === tasasId,
    )

    let tasasJson = included
      ? { data: included }
      : (await axiosJson.get(`${TASAS_API_BASE}${tasasId}`)).data

    const ofertas = parsearChubut(tasasJson)

    logMensaje(log, 'Chubut parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
