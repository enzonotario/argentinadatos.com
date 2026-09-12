import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { load } from 'cheerio'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'
import { logGrupo, logMensaje } from '@/log.js'

export const URL_MACRO_PLAZO_FIJO =
  'https://www.macro.com.ar/personas/inversiones/plazo-fijo'

const UMBRAL_TNA_PESOS = 0.05

const log = logGrupo({
  fuente: 'extraerMacroPlazoFijo',
  tipo: 'plazoFijo',
})

/**
 * Resuelve la URL del PDF de tasas desde el HTML de la landing.
 * @param {string} html
 * @returns {string|null}
 */
export function resolverUrlPdfMacroPlazoFijo(html) {
  if (!html || typeof html !== 'string') {
    return null
  }

  const $ = load(html)
  const href = $('a')
    .filter((_, el) => /conocer\s+tasas/i.test($(el).text()))
    .first()
    .attr('href')

  if (!href) {
    return null
  }

  if (href.startsWith('http')) {
    return href
  }

  return new URL(href, 'https://www.macro.com.ar').toString()
}

/**
 * @param {string} texto
 * @returns {number|null}
 */
function parsearMontoArs(texto) {
  if (!texto) {
    return null
  }

  const limpio = String(texto)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const valor = Number.parseFloat(limpio)

  return Number.isNaN(valor) ? null : valor
}

/**
 * @param {string} textoPdf
 * @returns {{ montoHasta: number|null, montoDesdeMasDe: number|null }}
 */
export function parsearLimitesMontoMacroPlazoFijo(textoPdf) {
  const texto = String(textoPdf)
  const matchHasta = texto.match(
    /Montos\s+de\s+\$?\s*1\s+a\s+\$?\s*([\d.]+,\d{2})/i,
  )
  const matchMasDe = texto.match(
    /Montos\s+m[aá]s\s+de\s+\$?\s*([\d.]+,\d{2})/i,
  )

  const montoHasta = matchHasta ? parsearMontoArs(matchHasta[1]) : null
  const umbralMasDe = matchMasDe ? parsearMontoArs(matchMasDe[1]) : montoHasta

  return {
    montoHasta,
    montoDesdeMasDe:
      umbralMasDe === null ? null : Number((umbralMasDe + 0.01).toFixed(2)),
  }
}

/**
 * @param {string} textoPdf
 * @returns {Array<{ plazoMinDias: number, plazoMaxDias: number|null, tna: number, tea: number }>}
 */
function extraerFilasPlazoTnaTea(textoPdf) {
  const texto = String(textoPdf)
  const regex =
    /(\d+)\s*-\s*(\d+)\s*d[ií]as\s*([\d.,]+)\s*%\s*([\d.,]+)\s*%|(\d+)\s*d[ií]as\s+o\s+m[aá]s\s*([\d.,]+)\s*%\s*([\d.,]+)\s*%/gi

  /** @type {Array<{ plazoMinDias: number, plazoMaxDias: number|null, tna: number, tea: number }>} */
  const filas = []
  let match

  while ((match = regex.exec(texto)) !== null) {
    if (match[1]) {
      const tna = porcentajeADecimal(match[3].replace(',', '.'))
      const tea = porcentajeADecimal(match[4].replace(',', '.'))

      if (tna === null) {
        continue
      }

      filas.push({
        plazoMinDias: Number.parseInt(match[1], 10),
        plazoMaxDias: Number.parseInt(match[2], 10),
        tna,
        tea,
      })
      continue
    }

    const tna = porcentajeADecimal(match[6].replace(',', '.'))
    const tea = porcentajeADecimal(match[7].replace(',', '.'))

    if (tna === null) {
      continue
    }

    filas.push({
      plazoMinDias: Number.parseInt(match[5], 10),
      plazoMaxDias: null,
      tna,
      tea,
    })
  }

  return filas
}

function mismoPlazo(a, b) {
  return a.plazoMinDias === b.plazoMinDias && a.plazoMaxDias === b.plazoMaxDias
}

function ordenarTasas(tasas) {
  return [...tasas].sort((a, b) => {
    const plazoA = a.plazoMinDias ?? 0
    const plazoB = b.plazoMinDias ?? 0

    if (plazoA !== plazoB) {
      return plazoA - plazoB
    }

    return (a.montoMinimo ?? 0) - (b.montoMinimo ?? 0)
  })
}

/**
 * Parsea las tasas en pesos de Banca Internet/App del PDF oficial.
 * El layout de dos columnas hace que pdf-parse intercale pizarra/sucursal e internet;
 * para cada plazo apareado se toma la TNA más alta (canal digital).
 *
 * @param {string} textoPdf
 * @returns {{ tasas: Array<object>, condiciones: string, condicionesCorto: string }|null}
 */
export function parsearMacroPlazoFijoPdf(textoPdf) {
  if (!textoPdf || typeof textoPdf !== 'string') {
    return null
  }

  const { montoHasta, montoDesdeMasDe } =
    parsearLimitesMontoMacroPlazoFijo(textoPdf)
  const filas = extraerFilasPlazoTnaTea(textoPdf)
  const pesos = []

  for (const fila of filas) {
    if (fila.tna <= UMBRAL_TNA_PESOS) {
      break
    }

    pesos.push(fila)
  }

  if (pesos.length === 0) {
    return null
  }

  /** @type {Array<object>} */
  const tasas = []
  let indice = 0

  while (indice < pesos.length) {
    const actual = pesos[indice]
    const siguiente = pesos[indice + 1]

    if (siguiente && mismoPlazo(actual, siguiente)) {
      const internet = actual.tna >= siguiente.tna ? actual : siguiente

      tasas.push({
        montoMinimo: 1,
        montoMaximo: montoHasta,
        plazoMinDias: internet.plazoMinDias,
        plazoMaxDias: internet.plazoMaxDias,
        tna: internet.tna,
      })

      indice += 2
      continue
    }

    // "366 días o más" solo aparece en pizarra sucursal.
    if (actual.plazoMaxDias === null) {
      indice += 1
      continue
    }

    break
  }

  while (indice < pesos.length) {
    const fila = pesos[indice]

    if (fila.plazoMaxDias === null) {
      indice += 1
      continue
    }

    tasas.push({
      montoMinimo: montoDesdeMasDe,
      montoMaximo: null,
      plazoMinDias: fila.plazoMinDias,
      plazoMaxDias: fila.plazoMaxDias,
      tna: fila.tna,
    })

    indice += 1
  }

  if (tasas.length === 0) {
    return null
  }

  return {
    tasas: ordenarTasas(tasas),
    condiciones:
      'Tasas plazo fijo en pesos — Banca Internet/App (Mercado Abierto)',
    condicionesCorto: 'App / Banca Internet',
  }
}

async function descargarPdf(url) {
  const respuesta = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept: 'application/pdf,*/*',
    },
    validateStatus: status => status >= 200 && status < 400,
  })

  return Buffer.from(respuesta.data)
}

async function resolverUrlPdf() {
  const respuesta = await axios.get(URL_MACRO_PLAZO_FIJO, {
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept: 'text/html,*/*',
    },
  })

  const url = resolverUrlPdfMacroPlazoFijo(respuesta.data)

  if (!url) {
    throw new Error(
      'No se encontró el link "Conocer tasas" en la landing de Macro',
    )
  }

  return url
}

/**
 * @param {Array<object>} items
 * @param {{ tasas: Array<object>, condiciones?: string, condicionesCorto?: string }|null} detalleMacro
 */
export function enriquecerPlazoFijoConMacro(items, detalleMacro) {
  if (!detalleMacro?.tasas?.length) {
    return items
  }

  return items.map(item => {
    if (!item.entidad?.toUpperCase().includes('MACRO')) {
      return item
    }

    const tna30 =
      detalleMacro.tasas.find(
        tramo => tramo.plazoMinDias === 30 && tramo.montoMinimo === 1,
      )?.tna ??
      detalleMacro.tasas.find(tramo => tramo.plazoMinDias === 30)?.tna

    return {
      ...item,
      enlace: item.enlace || URL_MACRO_PLAZO_FIJO,
      tasas: detalleMacro.tasas,
      condiciones: detalleMacro.condiciones ?? null,
      condicionesCorto: detalleMacro.condicionesCorto ?? null,
      ...(tna30 !== undefined ? { tnaClientes: tna30 } : {}),
    }
  })
}

export async function extraerMacroPlazoFijo() {
  const pdfUrl = await resolverUrlPdf()

  logMensaje(log, 'Descargando PDF de tasas Macro plazo fijo', { pdfUrl })

  const buffer = await descargarPdf(pdfUrl)
  const parsed = await pdf(buffer)
  const detalle = parsearMacroPlazoFijoPdf(parsed.text || '')

  if (!detalle) {
    throw new Error('PDF Macro plazo fijo sin tasas parseables')
  }

  logMensaje(log, 'Extracción de plazo fijo Macro exitosa', {
    tramos: detalle.tasas.length,
  })

  return detalle
}
