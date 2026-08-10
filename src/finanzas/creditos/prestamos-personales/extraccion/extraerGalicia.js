import axios from 'axios'
import { logGrupo, logError } from '@/log.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const PAGE_URL = 'https://www.galicia.ar/personas/prestamos/prestamo-personal'
const MODEL_URL =
  'https://www.galicia.ar/content/galicia/ar/es/home/personas/prestamos/prestamo-personal.model.json'

const log = logGrupo({
  fuente: 'extraerGaliciaPrestamosPersonales',
  tipo: 'extraccion',
})

const SERVICIOS = [
  {
    match: /SERVICIO\s+ÉMINENT/i,
    condiciones: 'Servicio Éminent',
  },
  {
    match: /SERVICIO\s+PLUS GOLD y PLUS/i,
    condiciones: 'Servicio PLUS GOLD y PLUS',
  },
  {
    match: /SERVICIO\s+MOVE/i,
    condiciones: 'Servicio MOVE',
  },
]

/**
 * @param {string} jsonOrHtml
 * @returns {Array<object>}
 */
export function parsearGalicia(jsonOrHtml) {
  const texto = String(jsonOrHtml)
  const ofertas = []
  const vistos = new Set()

  for (const servicio of SERVICIOS) {
    const idx = texto.search(servicio.match)

    if (idx < 0) continue

    const bloque = texto.slice(idx, idx + 900)

    const tnaMatch = bloque.match(/TNA:\s*([\d.,]+)\s*%/i)
    const cftMatch =
      bloque.match(/CFTEA C\/IVA:\s*([\d.,]+)\s*%/i) ||
      bloque.match(/CFTEA:\s*([\d.,]+)\s*%/i)
    const teaMatch =
      bloque.match(/CFTEA S\/IVA:\s*([\d.,]+)\s*%/i) ||
      bloque.match(/Tasa Efectiva Anual[^0-9]{0,40}TEA:\s*([\d.,]+)\s*%/i)
    const teaAlt = bloque.match(/(?<![A-Z])TEA:\s*([\d.,]+)\s*%/i)

    const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
    const cftTea = cftMatch ? parsePorcentaje(cftMatch[1]) : null
    const tea = teaMatch
      ? parsePorcentaje(teaMatch[1])
      : teaAlt
        ? parsePorcentaje(teaAlt[1])
        : null

    if (tna === null) continue

    const key = `${servicio.condiciones}:${tna}:${cftTea}`

    if (vistos.has(key)) continue

    vistos.add(key)

    ofertas.push({
      entidad: 'GALICIA',
      nombreComercial: 'Galicia',
      producto: 'Préstamo personal',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: true,
      condiciones: servicio.condiciones,
      enlace: PAGE_URL,
      vigenciaDesde: null,
      vigenciaHasta: null,
      metadata: {},
    })
  }

  return ofertas
}

export async function extraerGalicia() {
  try {
    const respuesta = await axios.get(MODEL_URL, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
        Accept: 'application/json',
      },
    })

    return parsearGalicia(respuesta.data)
  } catch (error) {
    logError(log, error)
    return []
  }
}
