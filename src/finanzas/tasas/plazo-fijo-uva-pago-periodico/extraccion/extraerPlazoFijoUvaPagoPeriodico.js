import axios from 'axios'
import { load } from 'cheerio'
import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { construirRequestConProxy } from '@/utils/proxy.js'

const log = logGrupo({
  fuente: 'extraerPlazoFijoUvaPagoPeriodico',
  tipo: 'extraccion',
})

const URL_BNA_PLAZO_FIJO_ELECTRONICO =
  'https://www.bna.com.ar/Personas/PlazoFijoElectronico'

const NOMBRE_PRODUCTO =
  'PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS'

const HEADERS_BNA = {
  'User-Agent':
    'Mozilla/5.0 (compatible; ArgentinaDatosBot/1.0; +https://argentinadatos.com)',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'es-AR,es;q=0.9',
}

const SCHEMA_TASAS_BNA = {
  tasas: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        plazoMinDias: { type: 'integer' },
        plazoMaxDias: { type: 'integer' },
        tna: { type: 'number' },
        tea: { type: 'number' },
      },
      required: ['plazoMinDias', 'plazoMaxDias', 'tna', 'tea'],
    },
  },
}

export async function extraerPlazoFijoUvaPagoPeriodico() {
  try {
    const proveedores = [...(await extraerBna())]

    return proveedores
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerBna() {
  const desdeHtml = await extraerBnaDesdeHtml()

  if (desdeHtml.length > 0) {
    return desdeHtml
  }

  logMensaje(log, 'HTML de BNA falló o vacío; usando Firecrawl')

  return extraerBnaDesdeFirecrawl()
}

async function extraerBnaDesdeHtml() {
  try {
    const request = construirRequestConProxy(URL_BNA_PLAZO_FIJO_ELECTRONICO, {
      headers: HEADERS_BNA,
    })

    if (request.usaProxy) {
      logMensaje(log, 'Consultando BNA via proxy')
    }

    const respuesta = await axios.get(request.url, {
      headers: request.opciones.headers,
    })

    const tasas = parsearTasasDesdeHtml(respuesta.data)

    if (tasas.length === 0) {
      logMensaje(log, 'HTML de BNA sin tabla UVA pago periódico')
      return []
    }

    logMensaje(log, 'Extracción BNA UVA pago periódico via HTML exitosa', {
      tramos: tasas.length,
      usaProxy: request.usaProxy,
    })

    return [construirProveedorBna(tasas)]
  } catch (error) {
    logMensaje(log, 'Error al obtener HTML de BNA', {
      errorMessage: error.message,
      status: error.response?.status,
    })
    return []
  }
}

async function extraerBnaDesdeFirecrawl() {
  try {
    logMensaje(log, 'Consultando BNA via Firecrawl')

    const datos = await scrapeWithFirecrawl(log, {
      url: URL_BNA_PLAZO_FIJO_ELECTRONICO,
      prompt: `Extraé las filas de la tabla titulada exactamente "${NOMBRE_PRODUCTO}" (plazo fijo UVA con pago de intereses por subperíodos de 30 días) del Banco Nación.

Ignorá otras tablas de la página (plazo fijo tradicional, precancelable UVA, etc.).

Para cada rango de plazo de esa tabla, devolvé un elemento en "tasas" con:
- plazoMinDias y plazoMaxDias: enteros del rango (ej. 90 y 119 para "De 90 a 119")
- tna y tea: el número de porcentaje publicado sin el símbolo % (ej. 0.25 para 0,25%; 4 para 4,00%)`,
      schema: SCHEMA_TASAS_BNA,
      required: ['tasas'],
    })

    const tasas = normalizarTasasFirecrawl(datos?.tasas)

    if (tasas.length === 0) {
      logMensaje(log, 'BNA sin tasas UVA pago periódico via Firecrawl')
      return []
    }

    logMensaje(log, 'Extracción BNA UVA pago periódico via Firecrawl exitosa', {
      tramos: tasas.length,
    })

    return [construirProveedorBna(tasas)]
  } catch (error) {
    logError(log, error)
    return []
  }
}

function construirProveedorBna(tasas) {
  return {
    id: 'bna',
    entidad: 'Banco de la Nación Argentina',
    logo: 'https://www.bna.com.ar/Content/img/logo-bna.png',
    tasas,
  }
}

function parsearTasasDesdeHtml(html) {
  const $ = load(html)
  const tabla = $(`table.plazoTable:contains("${NOMBRE_PRODUCTO}")`)

  if (!tabla.length) {
    return []
  }

  const tasas = []

  tabla.find('tbody tr').each((_, fila) => {
    const celdas = $(fila).find('td')

    if (celdas.length !== 3) {
      return
    }

    const plazos = parsearRangoPlazoDias($(celdas[0]).text().trim())

    if (!plazos) {
      return
    }

    const tna = parsearPorcentaje($(celdas[1]).text())
    const tea = parsearPorcentaje($(celdas[2]).text())

    if (tna === null || tea === null) {
      return
    }

    tasas.push({
      nombre: NOMBRE_PRODUCTO,
      plazoMinDias: plazos.plazoMinDias,
      plazoMaxDias: plazos.plazoMaxDias,
      tna,
      tea,
    })
  })

  return tasas
}

function normalizarTasasFirecrawl(tasas) {
  if (!Array.isArray(tasas)) {
    return []
  }

  return tasas
    .map(tramo => {
      const plazoMinDias = Number(tramo?.plazoMinDias)
      const plazoMaxDias = Number(tramo?.plazoMaxDias)
      const tna = porcentajeADecimal(tramo?.tna)
      const tea = porcentajeADecimal(tramo?.tea)

      if (
        !Number.isInteger(plazoMinDias) ||
        !Number.isInteger(plazoMaxDias) ||
        plazoMinDias <= 0 ||
        plazoMaxDias < plazoMinDias ||
        tna === null ||
        tea === null
      ) {
        return null
      }

      return {
        nombre: NOMBRE_PRODUCTO,
        plazoMinDias,
        plazoMaxDias,
        tna,
        tea,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.plazoMinDias - b.plazoMinDias)
}

function parsearRangoPlazoDias(texto) {
  if (!texto) return null

  const coincidencia = texto.match(/De\s+(\d+)\s+a\s+(\d+)/i)

  if (!coincidencia) return null

  const plazoMinDias = Number.parseInt(coincidencia[1], 10)
  const plazoMaxDias = Number.parseInt(coincidencia[2], 10)

  if (Number.isNaN(plazoMinDias) || Number.isNaN(plazoMaxDias)) return null

  return {
    plazoMinDias,
    plazoMaxDias,
  }
}

function parsearPorcentaje(valor) {
  if (!valor) return null

  const limpio = valor.replace('%', '').replace(',', '.').trim()
  const numero = Number.parseFloat(limpio)

  return Number.isNaN(numero) ? null : numero / 100
}

function porcentajeADecimal(valor) {
  if (typeof valor !== 'number' || Number.isNaN(valor)) {
    return null
  }

  return valor / 100
}
