import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const URL =
  'https://bancociudad.com.ar/institucional/micrositio/PrestamoPersonalCiudadVeloz'

const log = logGrupo({
  fuente: 'extraerCiudadPrestamosPersonales',
  tipo: 'extraccion',
})

const PRODUCTOS = [
  {
    match: /CIUDAD VELOZ PLAN SUELDO/i,
    producto: 'Ciudad Veloz Plan Sueldo',
    condiciones: 'Plan Sueldo',
    requiereCliente: true,
    plazoMaxDefault: 72,
  },
  {
    match: /CIUDAD VELOZ JUBILADOS Y PENSIONADOS/i,
    producto: 'Ciudad Veloz Jubilados y Pensionados ANSES',
    condiciones: 'Jubilados y Pensionados ANSES',
    requiereCliente: true,
    plazoMaxDefault: 72,
  },
  {
    match: /CIUDAD VELOZ CLIENTE FIEL/i,
    producto: 'Ciudad Veloz Cliente Fiel',
    condiciones: 'Cliente Fiel',
    requiereCliente: true,
    plazoMaxDefault: 72,
  },
]

/**
 * @param {string} htmlOrText
 * @returns {string}
 */
function aTexto(htmlOrText) {
  const $ = load(String(htmlOrText), null, false)
  const texto = ($('body').length ? $('body').text() : $.root().text()) || String(htmlOrText)
  return texto.replace(/\s+/g, ' ')
}

/**
 * @param {string} htmlOrText
 * @returns {Array<object>}
 */
export function parsearCiudad(htmlOrText) {
  const texto = aTexto(htmlOrText)
  const ofertas = []
  const vistos = new Set()

  const vigenciaMatch = texto.match(
    /DESDE EL\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+HASTA EL\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  )
  const vigenciaDesde = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[1])
    : null
  const vigenciaHasta = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[2])
    : null

  for (const producto of PRODUCTOS) {
    const idx = texto.search(producto.match)

    if (idx < 0) continue

    const bloque = texto.slice(idx, idx + 750)

    const tnaMatch = bloque.match(
      /T\.?\s*N\.?\s*A\.?\s*(?:\(TASA NOMINAL ANUAL\))?\s*:\s*([\d.,]+)\s*%/i,
    )
    const teaMatch = bloque.match(
      /T\.?\s*E\.?\s*A\.?\s*(?:\(TASA EFECTIVA ANUAL\))?\s*:\s*([\d.,]+)\s*%/i,
    )
    const cftMatch =
      bloque.match(
        /C\.?\s*F\.?\s*T\.?\s*E\.?\s*A\.?\s*C\/\s*IVA[^0-9%]{0,80}:\s*([\d.,]+)\s*%/i,
      ) ||
      bloque.match(/CFT C\/IVA:\s*([\d.,]+)\s*%/i)

    const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
    const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null
    const cftTea = cftMatch ? parsePorcentaje(cftMatch[1]) : null

    if (tna === null || cftTea === null) continue

    const key = `${producto.condiciones}:${tna}:${cftTea}`

    if (vistos.has(key)) continue

    vistos.add(key)

    const plazoMaxMatch = bloque.match(/Plazo m[aá]ximo\s+(\d+)\s+meses/i)
    const plazoMaxMeses = plazoMaxMatch
      ? Number.parseInt(plazoMaxMatch[1], 10)
      : producto.plazoMaxDefault
    const plazoMinMeses = 1

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
      entidad: 'CIUDAD',
      nombreComercial: 'Banco Ciudad',
      producto: producto.producto,
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: producto.requiereCliente,
      condiciones: producto.condiciones,
      enlace: URL,
      vigenciaDesde,
      vigenciaHasta,
      metadata: {
        plazoMesesEjemplo: plazoMaxMeses,
        plazoMinMeses,
        plazoMaxMeses,
        tasasPorPlazo,
      },
    })
  }

  // Completar plazos máximos desde las cards de marketing (orden: sueldo, jubilación, cliente).
  const plazosCards = [
    ...texto.matchAll(/Plazo m[aá]ximo\s+(\d+)\s+meses/gi),
  ].map((m) => Number.parseInt(m[1], 10))

  if (plazosCards.length >= ofertas.length) {
    for (let i = 0; i < ofertas.length; i++) {
      const plazoMaxMeses = plazosCards[i]
      ofertas[i].metadata.plazoMaxMeses = plazoMaxMeses
      ofertas[i].metadata.plazoMesesEjemplo = plazoMaxMeses
      ofertas[i].metadata.tasasPorPlazo[0].plazoMaxMeses = plazoMaxMeses
    }
  }

  return ofertas
}

export async function extraerCiudad() {
  try {
    const respuesta = await axios.get(URL, {
      responseType: 'text',
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    const ofertas = parsearCiudad(String(respuesta.data))

    logMensaje(log, 'Ciudad parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}
