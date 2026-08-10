import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const URL =
  'https://www.bna.com.ar/Personas/NacionSueldos-ConveniosGenerales'

const log = logGrupo({
  fuente: 'extraerBnaNacionSueldos',
  tipo: 'extraccion',
})

function detectarCondiciones($table) {
  const previo = $table.prevAll().slice(0, 8).text().replace(/\s+/g, ' ')

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
  const ofertas = []

  const afectacionMatch = $.root()
    .text()
    .match(/no debe superar el\s+(\d+)\s*%\s*del haber/i)

  const afectacionIngresos = afectacionMatch
    ? `${afectacionMatch[1]}%`
    : null

  $('table.cfttna').each((_, table) => {
    const $table = $(table)
    const celdas = $table
      .find('tbody tr')
      .first()
      .find('td')
      .map((__, td) => $(td).text().trim())
      .get()

    if (celdas.length < 5) return

    const tna = parsePorcentaje(celdas[1])
    const tea = parsePorcentaje(celdas[2])
    const cftTna = parsePorcentaje(celdas[3])
    const cftTea = parsePorcentaje(celdas[4])

    if (tna === null) return

    const { condiciones, requiereCliente } = detectarCondiciones($table)

    ofertas.push({
      entidad: 'BNA',
      nombreComercial: 'BNA',
      producto: 'Nación Sueldos',
      tna,
      tea,
      cftTna,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente,
      condiciones,
      enlace: URL,
      vigenciaDesde: null,
      vigenciaHasta: null,
      metadata: {
        ...(afectacionIngresos ? { afectacionIngresos } : {}),
      },
    })
  })

  return ofertas
}

export async function extraerBnaNacionSueldos() {
  try {
    const respuesta = await axios.get(URL, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      },
    })

    return parsearBnaNacionSueldos(respuesta.data)
  } catch (error) {
    logError(log, error)
    return []
  }
}
