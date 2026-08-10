import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const URL =
  'https://www.bna.com.ar/Personas/naciondestinolibre'

const log = logGrupo({
  fuente: 'extraerBnaPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearBna(html) {
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
    const clases = ($table.attr('class') || '').toLowerCase()
    const conCuentaNacion = clases.includes('numero_1')
    const sinCuentaNacion = clases.includes('numero_2')

    const celdas = $table
      .find('tbody tr')
      .first()
      .find('td')
      .map((__, td) => $(td).text().trim())
      .get()

    // [etiqueta, TNA, TEA, CFT TNA, CFT TEA]
    if (celdas.length < 5) return

    const tna = parsePorcentaje(celdas[1])
    const tea = parsePorcentaje(celdas[2])
    const cftTna = parsePorcentaje(celdas[3])
    const cftTea = parsePorcentaje(celdas[4])

    if (tna === null) return

    let condiciones = null
    let requiereCliente = null

    if (conCuentaNacion) {
      condiciones = 'Con paquete Cuenta Nación'
      requiereCliente = true
    } else if (sinCuentaNacion) {
      condiciones = 'Sin paquete Cuenta Nación'
      requiereCliente = false
    }

    ofertas.push({
      entidad: 'BNA',
      nombreComercial: 'BNA',
      producto: 'Nación Destino Libre',
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
        ...(afectacionIngresos
          ? { afectacionIngresos }
          : {}),
      },
    })
  })

  return ofertas
}

export async function extraerBna() {
  try {
    const respuesta = await axios.get(URL, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      },
    })

    return parsearBna(respuesta.data)
  } catch (error) {
    logError(log, error)
    return []
  }
}
