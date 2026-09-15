import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const RAVA_ARANCELES_URL =
  'https://www.rava.com/nuestros-servicios/aranceles'

const log = logGrupo({
  fuente: 'extraerRavaComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * @param {string} texto
 */
function normalizarTexto(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {string} concepto
 * @param {string} seccion
 * @returns {string[]}
 */
function productosDesdeRava(concepto, seccion) {
  const t = normalizarTexto(concepto)
  const sec = normalizarTexto(seccion)

  if (
    /dividend|amortizaci|mandato|conversion|adr|gasto|mantenimiento|transferencia/.test(
      t,
    )
  ) {
    return []
  }
  if (/^renta\b/.test(t) && !/variable|fija/.test(t)) return []
  if (/apertura de cuenta/.test(t)) return []

  if (/caucion/.test(t)) return ['cauciones']
  if (/opcion/.test(t)) return ['opciones']
  if (/prestamo/.test(t)) return ['alquiler_titulos']
  if (/licitacion/.test(t)) return ['licitaciones']
  // "Suscripción Bonos" es colocación primaria; se omite para no pisar Licitación.
  if (
    /futuro|rofex/.test(sec) ||
    /futuro|rofex|apertura\s*\/\s*cierre/.test(t)
  ) {
    return ['futuros']
  }

  if (/^contado/.test(t)) {
    if (/renta\s*variable/.test(sec)) return ['acciones', 'cedears']
    if (/renta\s*fija/.test(sec)) {
      return ['bonos', 'letras', 'obligaciones_negociables']
    }
  }

  return []
}

/**
 * @param {string} concepto
 * @returns {'ambas'|'colocadora'|'tomadora'}
 */
function operacionDesdeConcepto(concepto) {
  const t = normalizarTexto(concepto)
  if (/tomador/.test(t)) return 'tomadora'
  if (/colocador/.test(t)) return 'colocadora'
  return 'ambas'
}

/**
 * @param {string} celda
 * @returns {number|null}
 */
function parseDerechoMercado(celda) {
  const m = String(celda).match(/\bDM\s*([\d]+(?:[.,]\d+)?)\s*%/i)
  if (!m) return null
  const limpio = m[1].includes(',')
    ? m[1].replace(/\./g, '').replace(',', '.')
    : m[1]
  return porcentajeADecimal(Number.parseFloat(limpio), 6)
}

/**
 * @param {string} html
 */
export function parsearRava(html) {
  const $ = load(html)
  /** @type {Array<object>} */
  const filas = []
  /** @type {Set<string>} */
  const vistos = new Set()

  $('.ar-block').each((_, block) => {
    const seccion = $(block).find('.ar-caption, h2').first().text().trim()

    $(block)
      .find('table tr')
      .each((__, tr) => {
        const celdas = $(tr)
          .find('th,td')
          .map((___, c) => $(c).text().replace(/\s+/g, ' ').trim())
          .get()

        if (celdas.length < 2) return
        if (/operaciones de/i.test(celdas[0])) return

        const concepto = celdas[0]
        const tasaCelda = celdas[celdas.length - 1]
        const productos = productosDesdeRava(concepto, seccion)
        if (!productos.length) return

        const parsed = parseTasaComisionTexto(tasaCelda)
        if (parsed.tasa === null) return

        const operacion = operacionDesdeConcepto(concepto)
        const derechoMercado = parseDerechoMercado(tasaCelda)
        const esCaucion = productos.includes('cauciones')
        const esAlquiler = productos.includes('alquiler_titulos')
        const prorrata30 = /,\s*30\s*d\b/i.test(tasaCelda) || /prorrata/i.test(concepto)

        for (const producto of productos) {
          const clave = `${producto}|${operacion}`
          if (vistos.has(clave)) continue
          vistos.add(clave)

          filas.push(
            crearComisionBroker({
              entidad: 'rava',
              nombreComercial: 'Rava Bursátil',
              producto,
              operacion,
              moneda: 'ARS',
              canal: 'web',
              plan: null,
              tasa: parsed.tasa,
              tasaBase:
                (esCaucion || esAlquiler) && prorrata30
                  ? 'mensual'
                  : parsed.tasaBaseHint,
              tasaEsTope: true,
              incluyeIva: false,
              ivaAdicional: parsed.ivaAdicional || /\+?\s*IVA\b/i.test(tasaCelda),
              prorrateoDias: esCaucion || esAlquiler ? 30 : null,
              derechoMercado,
              enlace: RAVA_ARANCELES_URL,
              metadata: {
                fuenteUrl: RAVA_ARANCELES_URL,
                celdaOriginal: `${seccion} · ${concepto} | ${tasaCelda}`,
                notas:
                  productos.length > 1
                    ? `Aranceles máximos Rava (${seccion}). Concepto Contado expandido a ${producto}.`
                    : `Aranceles máximos publicados (${seccion}).`,
              },
            }),
          )
        }
      })
  })

  return filas
}

export async function extraerRava() {
  try {
    const respuesta = await axios.get(RAVA_ARANCELES_URL, {
      responseType: 'text',
      timeout: 25000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    const comisiones = parsearRava(String(respuesta.data))
    logMensaje(log, 'Rava parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
