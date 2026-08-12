import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const URL_DESTINO_LIBRE = 'https://bna.com.ar/Personas/NacionDestinoLibre'
const URL_NACION_SUELDOS =
  'https://bna.com.ar/Personas/NacionSueldos-ConveniosGenerales'
const URL_NACION_PREVISIONAL =
  'https://bna.com.ar/Personas/NacionPrevisionalBNA'

const log = logGrupo({
  fuente: 'extraerBnaPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Element} table
 * @returns {{ tna: number|null, tea: number|null, cftTna: number|null, cftTea: number|null }}
 */
function parsearFilaTasas($, table) {
  const celdas = $(table)
    .find('tbody tr')
    .first()
    .find('td')
    .map((_, td) => $(td).text().trim())
    .get()

  if (celdas.length < 5) {
    return { tna: null, tea: null, cftTna: null, cftTea: null }
  }

  return {
    tna: parsePorcentaje(celdas[1]),
    tea: parsePorcentaje(celdas[2]),
    cftTna: parsePorcentaje(celdas[3]),
    cftTea: parsePorcentaje(celdas[4]),
  }
}

/**
 * @param {string} texto
 * @returns {{ plazoMinMeses: number, plazoMaxMeses: number, plazoMesesEjemplo: number }}
 */
function parsearPlazos(texto) {
  const ejemploMatch =
    texto.match(
      /Calculado para\s*\$[\s\d.]+\s*de pr[eé]stamo(?:[^0-9]{0,80})?a\s+(\d+)\s*meses/i,
    ) ||
    texto.match(
      /Calculado para\s*\$[\s\d.]+\s*de pr[eé]stamo a\s+(\d+)\s*meses/i,
    )
  const maxMatch =
    texto.match(/hasta\s+(\d+)\s*meses/i) ||
    texto.match(/Hasta\s+(\d+)\s*cuotas/i) ||
    texto.match(/Plazos? y amortizaci[oó]n[^0-9]{0,40}(\d+)\s*meses/i)

  const plazoMaxMeses = maxMatch
    ? Number.parseInt(maxMatch[1], 10)
    : 72
  const plazoMesesEjemplo = ejemploMatch
    ? Number.parseInt(ejemploMatch[1], 10)
    : plazoMaxMeses

  return {
    plazoMinMeses: 1,
    plazoMaxMeses,
    plazoMesesEjemplo,
  }
}

/**
 * @param {string} texto
 * @returns {string|null}
 */
function parsearAfectacion(texto) {
  const m = texto.match(/no debe superar el\s+(\d+)\s*%\s*del haber/i)
  return m ? `${m[1]}%` : null
}

/**
 * @param {object} params
 * @returns {object}
 */
function armarOferta({
  producto,
  enlace,
  condiciones,
  requiereCliente,
  tna,
  tea,
  cftTna,
  cftTea,
  plazos,
  afectacionIngresos,
}) {
  const tasasPorPlazo = [
    {
      plazoMinMeses: plazos.plazoMinMeses,
      plazoMaxMeses: plazos.plazoMaxMeses,
      tna,
      tea,
      cftTea,
    },
  ]

  return {
    entidad: 'BNA',
    nombreComercial: 'Banco Nación',
    producto,
    tna,
    tea,
    cftTna,
    cftTea,
    tipoTasa: 'fija',
    moneda: 'ARS',
    requiereCliente,
    condiciones,
    enlace,
    vigenciaDesde: null,
    vigenciaHasta: null,
    metadata: {
      plazoMesesEjemplo: plazos.plazoMesesEjemplo,
      plazoMinMeses: plazos.plazoMinMeses,
      plazoMaxMeses: plazos.plazoMaxMeses,
      tasasPorPlazo,
      ...(afectacionIngresos ? { afectacionIngresos } : {}),
    },
  }
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearBnaDestinoLibre(html) {
  const $ = load(html)
  const texto = $.root().text().replace(/\s+/g, ' ')
  const plazos = parsearPlazos(texto)
  const afectacionIngresos = parsearAfectacion(texto)
  const ofertas = []

  $('table.cfttna').each((_, table) => {
    const $table = $(table)
    const clases = ($table.attr('class') || '').toLowerCase()
    const tasas = parsearFilaTasas($, table)

    if (tasas.tna === null) return

    let condiciones = null
    let requiereCliente = null

    if (clases.includes('numero_1')) {
      condiciones = 'Con paquete Cuenta Nación'
      requiereCliente = true
    } else if (clases.includes('numero_2')) {
      condiciones = 'Sin paquete Cuenta Nación'
      requiereCliente = false
    } else {
      return
    }

    ofertas.push(
      armarOferta({
        producto: 'Nación Destino Libre',
        enlace: URL_DESTINO_LIBRE,
        condiciones,
        requiereCliente,
        ...tasas,
        plazos,
        afectacionIngresos,
      }),
    )
  })

  return ofertas
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Cheerio} $table
 */
function detectarCondicionesSueldos($, $table) {
  const previo = $table.prevAll().slice(0, 8).text().replace(/\s+/g, ' ')
  const clases = ($table.attr('class') || '').toLowerCase()

  if (clases.includes('numero_2')) {
    return {
      condiciones: 'Empleados públicos nacionales sin haberes en BNA',
      requiereCliente: false,
    }
  }

  if (clases.includes('numero_1')) {
    return {
      condiciones: 'Empleados públicos nacionales con haberes en BNA',
      requiereCliente: true,
    }
  }

  if (/NO perciban sus haberes en el BNA/i.test(previo)) {
    return {
      condiciones: 'Empleados públicos nacionales sin haberes en BNA',
      requiereCliente: false,
    }
  }

  if (/cobren sus haberes en el BNA/i.test(previo)) {
    return {
      condiciones: 'Empleados públicos nacionales con haberes en BNA',
      requiereCliente: true,
    }
  }

  return {
    condiciones: 'Haberes en BNA · Convenios generales',
    requiereCliente: true,
  }
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearBnaNacionSueldos(html) {
  const $ = load(html)
  const texto = $.root().text().replace(/\s+/g, ' ')
  const plazos = parsearPlazos(texto)
  const afectacionIngresos = parsearAfectacion(texto)
  const ofertas = []

  $('table.cfttna').each((_, table) => {
    const $table = $(table)
    const tasas = parsearFilaTasas($, table)

    if (tasas.tna === null) return

    const { condiciones, requiereCliente } = detectarCondicionesSueldos(
      $,
      $table,
    )

    ofertas.push(
      armarOferta({
        producto: 'Nación Sueldos',
        enlace: URL_NACION_SUELDOS,
        condiciones,
        requiereCliente,
        ...tasas,
        plazos,
        afectacionIngresos,
      }),
    )
  })

  return ofertas
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearBnaNacionPrevisional(html) {
  const $ = load(html)
  const texto = $.root().text().replace(/\s+/g, ' ')
  const afectacionIngresos = parsearAfectacion(texto)

  /** @type {{ tna: number|null, tea: number|null, cftTna: number|null, cftTea: number|null }|null} */
  let tasas = null

  $('table.cfttna').each((_, table) => {
    if (tasas?.tna != null) return
    const parseadas = parsearFilaTasas($, table)
    if (parseadas.tna !== null) tasas = parseadas
  })

  if (!tasas || tasas.tna === null) return []

  const ejemploMatch = texto.match(
    /débito en cuenta a\s+(\d+)\s*meses/i,
  )
  const plazoMesesEjemplo = ejemploMatch
    ? Number.parseInt(ejemploMatch[1], 10)
    : 72

  const modalidades = [
    {
      condiciones: 'Jubilados con e@descuento obligatorio',
      plazoMaxMeses: 36,
    },
    {
      condiciones: 'Jubilados con débito en cuenta',
      plazoMaxMeses: 72,
    },
  ]

  // Si la tabla de usuarios no está, igual publicamos la modalidad del ejemplo (72).
  const tieneTablaUsuarios = /e@descuento/i.test(texto) && /débito en cuenta/i.test(texto)
  const variantes = tieneTablaUsuarios
    ? modalidades
    : [
        {
          condiciones: 'Jubilados y pensionados con haberes en BNA',
          plazoMaxMeses: plazoMesesEjemplo,
        },
      ]

  return variantes.map(({ condiciones, plazoMaxMeses }) =>
    armarOferta({
      producto: 'Nación Previsional BNA',
      enlace: URL_NACION_PREVISIONAL,
      condiciones,
      requiereCliente: true,
      ...tasas,
      plazos: {
        plazoMinMeses: 1,
        plazoMaxMeses,
        plazoMesesEjemplo: Math.min(plazoMesesEjemplo, plazoMaxMeses),
      },
      afectacionIngresos,
    }),
  )
}

async function fetchHtml(url) {
  const respuesta = await axios.get(url, {
    responseType: 'text',
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  return String(respuesta.data)
}

export async function extraerBna() {
  try {
    const [htmlSueldos, htmlDestino, htmlPrevisional] = await Promise.all([
      fetchHtml(URL_NACION_SUELDOS),
      fetchHtml(URL_DESTINO_LIBRE),
      fetchHtml(URL_NACION_PREVISIONAL),
    ])

    const ofertas = [
      ...parsearBnaNacionSueldos(htmlSueldos),
      ...parsearBnaDestinoLibre(htmlDestino),
      ...parsearBnaNacionPrevisional(htmlPrevisional),
    ]

    logMensaje(log, 'BNA parseado', {
      ofertas: ofertas.length,
      sueldos: ofertas.filter((o) => o.producto === 'Nación Sueldos').length,
      destinoLibre: ofertas.filter((o) => o.producto === 'Nación Destino Libre')
        .length,
      previsional: ofertas.filter((o) => o.producto === 'Nación Previsional BNA')
        .length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
