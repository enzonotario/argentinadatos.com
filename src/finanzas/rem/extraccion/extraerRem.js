import * as XLSX from 'xlsx'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerRem',
  tipo: 'extraccion',
})

const BCRA_BASE_URL = 'https://www.bcra.gob.ar'
const BCRA_ULTIMOS_INFORMES_URL = `${BCRA_BASE_URL}/ultimos-informes/`
const BCRA_PUBLICACIONES_API_URL = `${BCRA_BASE_URL}/wp-json/bcra/v1/publicaciones?category=informes%2Cestadisticas&lang=es&action=total`
const CANTIDAD_INFORMES_REM = 12

const MESES = {
  ene: 0,
  jan: 0,
  enero: 0,
  january: 0,
  feb: 1,
  febrero: 1,
  february: 1,
  mar: 2,
  marzo: 2,
  march: 2,
  abr: 3,
  apr: 3,
  abril: 3,
  april: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  june: 5,
  jul: 6,
  julio: 6,
  july: 6,
  ago: 7,
  aug: 7,
  agosto: 7,
  august: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  september: 8,
  oct: 9,
  octubre: 9,
  october: 9,
  nov: 10,
  noviembre: 10,
  november: 10,
  dic: 11,
  dec: 11,
  diciembre: 11,
  december: 11,
}

const TRIMESTRES = {
  i: [0, 2],
  ii: [3, 5],
  iii: [6, 8],
  iv: [9, 11],
}

function esperarMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchConTimeout(
  url,
  opciones = {},
  timeoutMs = 8000,
  intentos = 3,
) {
  let ultimoError = null

  for (let intento = 1; intento <= intentos; intento++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(url, {
        ...opciones,
        signal: controller.signal,
      })
    } catch (error) {
      ultimoError = error

      if (intento === intentos) throw error

      await esperarMs(500 * intento)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw ultimoError
}

const NOMBRES_COLUMNAS = {
  periodo: 'periodo',
  referencia: 'referencia',
  mediana: 'mediana',
  promedio: 'promedio',
  desvio: 'desvio',
  desvío: 'desvio',
  maximo: 'maximo',
  máximo: 'maximo',
  minimo: 'minimo',
  mínimo: 'minimo',
  'percentil 90': 'percentil90',
  'percentil 75': 'percentil75',
  'percentil 25': 'percentil25',
  'percentil 10': 'percentil10',
  'cantidad de participantes': 'participantes',
}

export function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function parsearNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'number') return valor

  let texto = String(valor).trim()

  if (!texto) return null

  texto = texto.replace(/\s/g, '').replace(/%/g, '')

  if (texto.includes(',') && texto.includes('.')) {
    texto = texto.replace(/,/g, '')
  } else if (texto.includes(',')) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(texto)) {
      texto = texto.replace(/,/g, '')
    } else {
      texto = texto.replace(',', '.')
    }
  }

  const numero = Number(texto)

  return isNaN(numero) ? null : numero
}

function normalizarAnio(anio) {
  const numero = Number(anio)

  if (numero < 100) return 2000 + numero

  return numero
}

function fechaIso(anio, mes, dia) {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate()
}

export function parsearPeriodo(periodo) {
  const textoOriginal = String(periodo || '').trim()
  const texto = normalizarTexto(textoOriginal)

  let coincidencia = texto.match(/^([a-z]{3,10})[-\s](\d{2,4})$/)

  if (coincidencia) {
    const mes = MESES[coincidencia[1]]
    const anio = normalizarAnio(coincidencia[2])

    if (mes !== undefined) {
      return {
        tipo: 'mensual',
        desde: fechaIso(anio, mes, 1),
        hasta: fechaIso(anio, mes, ultimoDiaDelMes(anio, mes)),
      }
    }
  }

  coincidencia = texto.match(/^trim\.\s*(i{1,3}|iv)[-\s](\d{2,4})$/)

  if (coincidencia) {
    const meses = TRIMESTRES[coincidencia[1]]
    const anio = normalizarAnio(coincidencia[2])

    return {
      tipo: 'trimestral',
      desde: fechaIso(anio, meses[0], 1),
      hasta: fechaIso(anio, meses[1], ultimoDiaDelMes(anio, meses[1])),
    }
  }

  coincidencia = texto.match(/^(\d{4})$/)

  if (coincidencia) {
    const anio = Number(coincidencia[1])

    return {
      tipo: 'anual',
      desde: `${anio}-01-01`,
      hasta: `${anio}-12-31`,
    }
  }

  if (texto.includes('12 meses'))
    return {
      tipo: 'proximos_12_meses',
      desde: null,
      hasta: null,
    }

  if (texto.includes('24 meses'))
    return {
      tipo: 'proximos_24_meses',
      desde: null,
      hasta: null,
    }

  return {
    tipo: 'otro',
    desde: null,
    hasta: null,
  }
}

export function parsearFechaReferencia(referencia) {
  const texto = normalizarTexto(referencia)
  let coincidencia = texto.match(
    /(ene|jan|feb|mar|abr|apr|may|jun|jul|ago|aug|sep|sept|oct|nov|dic|dec)[-\s](\d{2,4})/,
  )

  if (coincidencia) {
    const mes = MESES[coincidencia[1]]
    const anio = normalizarAnio(coincidencia[2])

    return fechaIso(anio, mes, 1)
  }

  coincidencia = texto.match(/trim\.\s*(i{1,3}|iv)[-\s](\d{2,4})/)

  if (coincidencia) {
    const meses = TRIMESTRES[coincidencia[1]]
    const anio = normalizarAnio(coincidencia[2])

    return fechaIso(anio, meses[1], ultimoDiaDelMes(anio, meses[1]))
  }

  return null
}

export function inferirUnidad(referencia) {
  const texto = String(referencia || '').trim()
  const partes = texto
    .split(';')
    .map(p => p.trim())
    .filter(Boolean)

  return partes[0] || texto || null
}

export function parsearInformeDesdeTitulo(titulo) {
  const texto = normalizarTexto(titulo)
  const coincidencia = texto.match(
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})/,
  )

  if (!coincidencia) return null

  const mes = MESES[coincidencia[1]]
  const anio = Number(coincidencia[2])

  return `${anio}-${String(mes + 1).padStart(2, '0')}`
}

export function parsearInformeDesdeUrl(url) {
  const texto = normalizarTexto(url)
  const coincidencia = texto.match(
    /(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[a-z]*-(\d{4})/,
  )

  if (!coincidencia) return null

  const mes = MESES[coincidencia[1]]
  const anio = Number(coincidencia[2])

  if (mes === undefined || isNaN(anio)) return null

  return `${anio}-${String(mes + 1).padStart(2, '0')}`
}

function esPublicacionRem(titulo, url) {
  const tituloNormalizado = normalizarTexto(titulo)
  const urlNormalizada = normalizarTexto(url)

  return (
    tituloNormalizado.includes('relevamiento de expectativas de mercado') ||
    urlNormalizada.includes('relevamiento-de-expectativas-de-mercado')
  )
}

export function obtenerUrlsPublicacionesRemDesdeApiPublicaciones(
  payload,
  limite = CANTIDAD_INFORMES_REM,
) {
  const publicaciones =
    payload?.data?.publicaciones ?? payload?.publicaciones ?? []

  const urls = []
  const vistos = new Set()

  for (const publicacion of publicaciones) {
    const url = resolverUrl(publicacion.url, BCRA_BASE_URL)

    if (!url || !esPublicacionRem(publicacion.titulo, url)) continue
    if (vistos.has(url)) continue

    vistos.add(url)
    urls.push(url)
  }

  return urls.slice(0, limite)
}

export function obtenerUrlsPublicacionesRemDesdeHtmlUltimosInformes(
  html,
  baseUrl = BCRA_ULTIMOS_INFORMES_URL,
  limite = CANTIDAD_INFORMES_REM,
) {
  const urls = []
  const vistos = new Set()
  const coincidencias = [
    ...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ]

  for (const coincidencia of coincidencias) {
    const href = coincidencia[1]
    const texto = coincidencia[2].replace(/<[^>]+>/g, ' ')
    const url = resolverUrl(href, baseUrl)

    if (!url) continue

    if (!esPublicacionRem(texto, url) || vistos.has(url)) continue

    vistos.add(url)
    urls.push(url)
  }

  return urls.slice(0, limite)
}

export async function obtenerUrlsPublicacionesRemDesdeUltimosInformes(
  publicacionesUrl = BCRA_PUBLICACIONES_API_URL,
  limite = CANTIDAD_INFORMES_REM,
) {
  const respuesta = await fetchConTimeout(publicacionesUrl, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!respuesta.ok) return []

  const payload = await respuesta.json()

  if (payload?.success === false) return []

  return obtenerUrlsPublicacionesRemDesdeApiPublicaciones(payload, limite)
}

export function resolverUrl(href, baseUrl = BCRA_BASE_URL) {
  if (!href) return null

  const limpio = href.replace(/^blank:#/, '')

  try {
    const url = new URL(limpio, baseUrl)

    if (url.hostname === 'sitiopublico.desa.bcra.net') {
      url.protocol = 'https:'
      url.hostname = 'www.bcra.gob.ar'
    }

    return url.toString()
  } catch (_) {
    return null
  }
}

export function obtenerUrlXlsxDesdeHtml(html, baseUrl = BCRA_BASE_URL) {
  const coincidencias = [
    ...html.matchAll(/href=["']([^"']+\.xlsx[^"']*)["']/gi),
  ]

  const urls = coincidencias
    .map(m => resolverUrl(m[1], baseUrl))
    .filter(Boolean)
    .filter(url =>
      normalizarTexto(url).includes('relevamiento-expectativas-mercado'),
    )

  return urls[0] || null
}

export async function obtenerPublicacionesRem(urls) {
  if (!urls) urls = await obtenerUrlsPublicacionesRemDesdeUltimosInformes()

  const publicaciones = []
  const vistos = new Set()

  for (const url of urls) {
    try {
      const respuesta = await fetchConTimeout(url)

      if (!respuesta.ok) continue

      const html = await respuesta.text()
      const xlsxUrl = obtenerUrlXlsxDesdeHtml(html, url)

      if (!xlsxUrl || vistos.has(xlsxUrl)) continue

      vistos.add(xlsxUrl)

      const coincidenciaTitulo = html.match(/<title>([^<]+)<\/title>/i)
      const titulo = coincidenciaTitulo ? coincidenciaTitulo[1] : ''

      publicaciones.push({
        url,
        xlsxUrl,
        informe:
          parsearInformeDesdeTitulo(titulo) || parsearInformeDesdeUrl(xlsxUrl),
      })
    } catch (error) {
      logError(log, error)
    }
  }

  return publicaciones.sort((a, b) => (a.informe < b.informe ? 1 : -1))
}

function esFilaEncabezado(fila) {
  return (
    normalizarTexto(fila[0]) === 'periodo' &&
    normalizarTexto(fila[1]) === 'referencia'
  )
}

function esFilaSeccion(fila) {
  return fila[0] && !fila[1] && !esFilaEncabezado(fila)
}

function normalizarEncabezados(fila) {
  return fila.map(celda => NOMBRES_COLUMNAS[normalizarTexto(celda)] || null)
}

export function parsearWorkbookRem(buffer, publicacion = {}) {
  const libro = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
  })

  const resultados = []
  const informe =
    publicacion.informe || parsearInformeDesdeUrl(publicacion.xlsxUrl)

  for (const nombreHoja of ['Cuadros de resultados', 'Resultados TOP 10']) {
    const hoja = libro.Sheets[nombreHoja]

    if (!hoja) continue

    const muestra = nombreHoja === 'Resultados TOP 10' ? 'top_10' : 'todos'

    const filas = XLSX.utils.sheet_to_json(hoja, {
      header: 1,
      raw: false,
      defval: null,
      blankrows: false,
    })

    let indicador = null
    let encabezados = []

    for (const fila of filas) {
      if (!fila || fila.length === 0) continue

      if (normalizarTexto(fila[0]).startsWith('fuente:')) continue

      if (normalizarTexto(fila[0]).startsWith('relevamiento de expectativas')) {
        continue
      }

      if (esFilaSeccion(fila)) {
        indicador = String(fila[0]).trim()
        encabezados = []
        continue
      }

      if (esFilaEncabezado(fila)) {
        encabezados = normalizarEncabezados(fila)
        continue
      }

      if (!indicador || encabezados.length === 0 || !fila[0] || !fila[1])
        continue

      const item = {
        informe,
        fecha: informe ? `${informe}-01` : null,
        muestra,
        indicador,
        periodo: String(fila[0]).trim(),
        referencia: String(fila[1]).trim(),
        unidad: inferirUnidad(fila[1]),
        fuente: 'BCRA REM',
        publicacionUrl: publicacion.url || null,
        xlsxUrl: publicacion.xlsxUrl || null,
      }

      const periodoNormalizado = parsearPeriodo(item.periodo)

      item.periodoTipo = periodoNormalizado.tipo
      item.periodoDesde = periodoNormalizado.desde
      item.periodoHasta = periodoNormalizado.hasta
      item.referenciaFecha = parsearFechaReferencia(item.referencia)

      for (let i = 2; i < fila.length; i++) {
        const columna = encabezados[i]

        if (!columna) continue

        item[columna] =
          columna === 'participantes'
            ? parsearNumero(fila[i])
            : parsearNumero(fila[i])
      }

      resultados.push(item)
    }
  }

  return resultados
}

export async function extraerRem(urls) {
  const publicaciones = await obtenerPublicacionesRem(urls)
  const resultados = []

  for (const publicacion of publicaciones) {
    try {
      const respuesta = await fetchConTimeout(publicacion.xlsxUrl)

      if (!respuesta.ok) continue

      const buffer = await respuesta.arrayBuffer()
      resultados.push(...parsearWorkbookRem(buffer, publicacion))
    } catch (error) {
      logError(log, error)
    }
  }

  return resultados
}
