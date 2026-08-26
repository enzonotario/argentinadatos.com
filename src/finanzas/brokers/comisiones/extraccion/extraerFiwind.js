import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  normalizarProducto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const FIWIND_COMISIONES_URL = 'https://www.fiwind.io/comisiones'

const log = logGrupo({
  fuente: 'extraerFiwindComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * Extrae triples Instrumento / Arancel / Unidad de las grillas Webflow.
 * @param {string} html
 * @returns {Array<{ instrumento: string, arancel: string, unidad: string }>}
 */
function extraerItemsTabla(html) {
  const $ = load(html)
  /** @type {Array<{ instrumento: string, arancel: string, unidad: string }>} */
  const items = []

  $('.alyc-comision-table-item').each((_, el) => {
    const textos = $(el)
      .find('.alyc_title_name-content')
      .map((__, n) => $(n).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean)

    if (textos.length >= 3) {
      items.push({
        instrumento: textos[0],
        arancel: textos[1],
        unidad: textos[2],
      })
    } else if (textos.length === 2) {
      items.push({
        instrumento: textos[0],
        arancel: textos[1],
        unidad: '',
      })
    }
  })

  if (items.length) return items

  // Fallback texto plano: "Acciones 0.25%* Directo"
  const plano = $('body').text().replace(/\s+/g, ' ')
  const re =
    /\b(Acciones|CEDEARS?|Letras|Caución|Caucion)\s+([\d]+(?:[.,]\d+)?)\s*%\*?\s*(Directo|Anual|BYMA)/gi
  for (const m of plano.matchAll(re)) {
    items.push({
      instrumento: m[1],
      arancel: `${m[2]}%`,
      unidad: m[3],
    })
  }
  return items
}

/**
 * @param {string} html
 */
export function parsearFiwind(html) {
  const items = extraerItemsTabla(html)
  /** @type {Map<string, number>} */
  const derechos = new Map()
  /** @type {Array<object>} */
  const filas = []

  for (const item of items) {
    const producto = normalizarProducto(item.instrumento)
    if (!producto) continue

    const unidad = item.unidad.toLowerCase()
    const esByma = /byma/.test(unidad)
    const parsed = parseTasaComisionTexto(item.arancel)
    if (parsed.tasa === null) continue

    if (esByma) {
      derechos.set(producto, parsed.tasa)
      continue
    }

    const esCaucion = producto === 'cauciones'
    const tasaBase =
      parsed.tasaBaseHint ||
      (/anual/i.test(item.unidad) || esCaucion
        ? 'anual'
        : /letra/i.test(item.instrumento)
          ? 'anual'
          : null)

    filas.push(
      crearComisionBroker({
        entidad: 'fiwind',
        nombreComercial: 'Fiwind',
        producto,
        operacion: esCaucion ? 'ambas' : 'ambas',
        moneda: 'ARS',
        canal: 'web',
        plan: null,
        tasa: parsed.tasa,
        tasaBase,
        tasaEsTope: true,
        incluyeIva: false,
        ivaAdicional: true,
        prorrateoDias: null,
        derechoMercado: null,
        enlace: FIWIND_COMISIONES_URL,
        metadata: {
          fuenteUrl: FIWIND_COMISIONES_URL,
          celdaOriginal: `${item.instrumento} | ${item.arancel} | ${item.unidad}`,
          notas:
            'Comisión máxima publicada. Precios sin IVA. Derecho de mercado BYMA aparte.',
        },
      }),
    )
  }

  for (const fila of filas) {
    const derecho =
      derechos.get(fila.producto) ??
      (fila.producto === 'cauciones'
        ? porcentajeADecimal(0.045, 6)
        : null)
    fila.derechoMercado = derecho
  }

  return filas
}

export async function extraerFiwind() {
  try {
    const respuesta = await axios.get(FIWIND_COMISIONES_URL, {
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

    const comisiones = parsearFiwind(String(respuesta.data))
    logMensaje(log, 'Fiwind parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
