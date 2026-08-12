import axios from 'axios'
import * as cheerio from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const GETNET_ARANCELES_URL = 'https://www.getnet.net/ar/aranceles'

const log = logGrupo({
  fuente: 'extraerGetnetComisionesCobro',
  tipo: 'extraccion',
})

const COLUMNAS_ACREDITACION = [
  {
    tipo: 'inmediata',
    label: 'Acreditación inmediata',
    plazoDefault: 0,
  },
  {
    tipo: 'anticipada',
    label: 'Acreditación anticipada (24 horas hábiles)',
    plazoDefault: 1,
  },
  {
    tipo: 'estandar',
    label: 'Plazo estándar',
    plazoDefault: null,
  },
]

/**
 * @param {string} medioTexto
 * @returns {{ producto: string, canal: string, medioPago: string, condiciones: string|null }|null}
 */
function mapearMedioGetnet(medioTexto) {
  const texto = String(medioTexto)
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = texto.toLowerCase()

  if (/qr/.test(lower) && /cuenta/.test(lower)) {
    return {
      producto: 'QR dinero en cuenta',
      canal: 'qr',
      medioPago: 'qr_cuenta',
      condiciones: null,
    }
  }

  if (/d[eé]bito/.test(lower)) {
    return {
      producto: 'Débito',
      canal: 'pos',
      medioPago: 'debito',
      condiciones: null,
    }
  }

  if (/cr[eé]dito/.test(lower) && /cuotas/.test(lower)) {
    return {
      producto: 'Crédito en cuotas',
      canal: 'pos',
      medioPago: 'credito_cuotas',
      condiciones:
        'No contempla CFT; ver coeficientes de financiación en la fuente.',
    }
  }

  if (/cr[eé]dito/.test(lower)) {
    return {
      producto: 'Crédito 1 pago',
      canal: 'pos',
      medioPago: 'credito',
      condiciones:
        'Aplicable a crédito y prepagas. Internacionales Visa/Mastercard: +0,7%.',
    }
  }

  return null
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearGetnet(html) {
  const $ = cheerio.load(String(html))
  const tabla = $('table').first()

  if (!tabla.length) {
    return []
  }

  /** @type {Array<object>} */
  const comisiones = []

  tabla.find('tr').each((index, tr) => {
    if (index === 0) return

    const celdas = $(tr)
      .find('th, td')
      .map((_, celda) =>
        $(celda)
          .text()
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .get()

    if (celdas.length < 4) return

    const medio = mapearMedioGetnet(celdas[0])
    if (!medio) return

    for (let i = 0; i < 3; i += 1) {
      const celda = celdas[i + 1]
      const columna = COLUMNAS_ACREDITACION[i]
      const parsed = parseArancelTexto(celda)

      if (parsed.arancel === null && (!celda || celda === '-')) {
        continue
      }

      const plazo =
        parsed.acreditacionPlazoHabiles ?? columna.plazoDefault

      let acreditacionLabel = columna.label
      if (parsed.acreditacionPlazoHabiles != null) {
        acreditacionLabel = `${columna.label} (${parsed.acreditacionPlazoHabiles} día${parsed.acreditacionPlazoHabiles === 1 ? '' : 's'} hábil${parsed.acreditacionPlazoHabiles === 1 ? '' : 'es'})`
      }

      comisiones.push(
        crearComisionCobro({
          entidad: 'getnet',
          nombreComercial: 'Getnet',
          producto: medio.producto,
          canal: medio.canal,
          medioPago: medio.medioPago,
          arancel: parsed.arancel,
          arancelEsTope: parsed.arancelEsTope,
          incluyeIva: false,
          ivaAdicional: true,
          acreditacionTipo: columna.tipo,
          acreditacionPlazoHabiles: plazo,
          acreditacionLabel,
          condiciones: medio.condiciones,
          enlace: GETNET_ARANCELES_URL,
          metadata: {
            fuenteUrl: GETNET_ARANCELES_URL,
            celdaOriginal: celda,
          },
        }),
      )
    }
  })

  return comisiones
}

async function fetchHtml() {
  const respuesta = await axios.get(GETNET_ARANCELES_URL, {
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

  return String(respuesta.data)
}

export async function extraerGetnet() {
  try {
    const html = await fetchHtml()
    const comisiones = parsearGetnet(html)

    logMensaje(log, 'Getnet parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
