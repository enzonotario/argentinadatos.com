import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parsePorcentaje } from './parsePorcentaje.js'

const PAGE_URL = 'https://www.galicia.ar/personas/prestamos/prestamo-personal'
const MODEL_URLS = [
  'https://www.galicia.ar/personas/prestamos/prestamo-personal.model.json',
  'https://www.galicia.ar/content/galicia/ar/es/home/personas/prestamos/prestamo-personal.model.json',
]

const log = logGrupo({
  fuente: 'extraerGaliciaPrestamosPersonales',
  tipo: 'extraccion',
})

const SERVICIOS = [
  {
    match: /SERVICIO\s+ÉMINENT/i,
    condiciones: 'Servicio Éminent',
    producto: 'Préstamo personal Éminent',
  },
  {
    match: /SERVICIO\s+PLUS GOLD y PLUS/i,
    condiciones: 'Servicio PLUS GOLD y PLUS',
    producto: 'Préstamo personal PLUS',
  },
  {
    match: /SERVICIO\s+MOVE/i,
    condiciones: 'Servicio MOVE',
    producto: 'Préstamo personal MOVE',
  },
]

/**
 * @param {string} texto
 * @returns {{ plazoMinMeses: number, plazoMaxMeses: number, plazoMesesEjemplo: number }}
 */
function parsearPlazos(texto) {
  const rangoMatch = texto.match(
    /plazos m[aá]ximos de hasta\s+(\d+)\s*meses y m[ií]nimo de\s+(\d+)\s*meses/i,
  )
  const maxMatch =
    texto.match(/hasta\s+(\d+)\s*cuotas fijas/i) ||
    texto.match(/hasta\s+(\d+)\s*meses/i)
  const ejemploMatch = texto.match(/con TNA\s+[\d.,]+%\s*,\s*en\s+(\d+)\s*cuotas/i)

  const plazoMaxMeses = rangoMatch
    ? Number.parseInt(rangoMatch[1], 10)
    : maxMatch
      ? Number.parseInt(maxMatch[1], 10)
      : 72
  const plazoMinMeses = rangoMatch
    ? Number.parseInt(rangoMatch[2], 10)
    : 6
  const plazoMesesEjemplo = ejemploMatch
    ? Number.parseInt(ejemploMatch[1], 10)
    : 12

  return { plazoMinMeses, plazoMaxMeses, plazoMesesEjemplo }
}

/**
 * @param {string} jsonOrHtml
 * @returns {Array<object>}
 */
export function parsearGalicia(jsonOrHtml) {
  const texto = String(jsonOrHtml)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')

  const { plazoMinMeses, plazoMaxMeses, plazoMesesEjemplo } =
    parsearPlazos(texto)

  const ofertas = []
  const vistos = new Set()

  for (const servicio of SERVICIOS) {
    const idx = texto.search(servicio.match)

    if (idx < 0) continue

    const bloque = texto.slice(idx, idx + 700)

    const tnaMatch = bloque.match(/TNA:\s*([\d.,]+)\s*%/i)
    const cftMatch =
      bloque.match(/CFTEA C\/IVA:\s*([\d.,]+)\s*%/i) ||
      bloque.match(/CFTEA:\s*([\d.,]+)\s*%/i)
    const teaMatch =
      bloque.match(/(?<![A-Z])TEA:\s*([\d.,]+)\s*%/i) ||
      bloque.match(/CFTEA S\/IVA:\s*([\d.,]+)\s*%/i)

    const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
    const cftTea = cftMatch ? parsePorcentaje(cftMatch[1]) : null
    const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null

    if (tna === null) continue

    const key = `${servicio.condiciones}:${tna}:${cftTea}`

    if (vistos.has(key)) continue

    vistos.add(key)

    const tasasPorPlazo = [
      {
        plazoMinMeses,
        plazoMaxMeses,
        tna,
        tea,
        cftTea,
      },
    ]

    ofertas.push({
      entidad: 'GALICIA',
      nombreComercial: 'Galicia',
      producto: servicio.producto,
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
      metadata: {
        plazoMesesEjemplo,
        plazoMinMeses,
        plazoMaxMeses,
        tasasPorPlazo,
      },
    })
  }

  return ofertas
}

async function fetchModel() {
  let ultimoError = null

  for (const url of MODEL_URLS) {
    try {
      const respuesta = await axios.get(url, {
        responseType: 'text',
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
          Accept: 'application/json,text/plain,*/*',
        },
      })

      return String(respuesta.data)
    } catch (error) {
      ultimoError = error
      logMensaje(log, 'Galicia model.json no disponible', {
        url,
        errorMessage: error.message,
      })
    }
  }

  throw ultimoError || new Error('Galicia model.json no disponible')
}

export async function extraerGalicia() {
  try {
    const contenido = await fetchModel()
    const ofertas = parsearGalicia(contenido)

    logMensaje(log, 'Galicia parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
