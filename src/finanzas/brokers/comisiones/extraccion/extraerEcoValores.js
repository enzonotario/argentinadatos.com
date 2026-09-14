import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  productosDesdeConcepto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const ECO_TARIFARIO_URL = 'https://www.ecovalores.com.ar/tarifario.php'

const log = logGrupo({
  fuente: 'extraerEcoValoresComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * Retail comparable: No Asesorados / Sin Club / Sin Intraday (1ª columna de tasa).
 * @param {string} html
 */
export function parsearEcoValores(html) {
  const $ = load(html)
  /** @type {Array<object>} */
  const filas = []

  const tabRetail = $('#tab-no-asesorado')
  tabRetail.find('table tbody tr').each((_, tr) => {
    const celdas = $(tr)
      .find('th,td')
      .map((__, c) => $(c).text().replace(/\s+/g, ' ').trim())
      .get()

    if (celdas.length < 2) return

    const concepto = celdas[0]
    const tasaCelda = celdas[1]
    const derechoCelda = celdas[celdas.length - 1]

    if (/^no aplica$/i.test(tasaCelda) || tasaCelda === '—' || !tasaCelda) {
      return
    }

    const productos = productosDesdeConcepto(concepto)
    if (!productos.length) return

    // Un solo futuro retail comparable (RFX20 / acciones); omitimos agro/FX.
    if (productos.includes('futuros') && !/rfx20|acciones/i.test(concepto)) {
      return
    }

    const parsed = parseTasaComisionTexto(tasaCelda)
    if (parsed.tasa === null) return

    const derechoParsed = parseTasaComisionTexto(derechoCelda)

    for (const producto of productos) {
      filas.push(
        crearComisionBroker({
          entidad: 'ecovalores',
          nombreComercial: 'Eco Valores',
          producto,
          operacion: 'ambas',
          moneda: 'ARS',
          canal: 'web',
          plan: 'no_asesorado',
          tasa: parsed.tasa,
          tasaBase: parsed.tasaBaseHint,
          tasaEsTope: parsed.tasaEsTope,
          incluyeIva: false,
          ivaAdicional: true,
          derechoMercado: derechoParsed.tasa,
          enlace: ECO_TARIFARIO_URL,
          metadata: {
            fuenteUrl: ECO_TARIFARIO_URL,
            celdaOriginal: `${concepto} | Sin Club / Sin Intraday: ${tasaCelda}`,
            notas:
              productos.length > 1
                ? `Tarifario No Asesorados. Concepto unificado; fila expandida a ${producto}.`
                : 'Tarifario No Asesorados (Sin Club / Sin Intraday). IVA adicional según corresponda.',
          },
        }),
      )
    }
  })

  const tabMax = $('#tab-tarifas-maximas')
  tabMax.find('table tbody tr').each((_, tr) => {
    const celdas = $(tr)
      .find('th,td')
      .map((__, c) => $(c).text().replace(/\s+/g, ' ').trim())
      .get()

    if (celdas.length < 2) return

    const concepto = celdas[0]
    const tasaCelda = celdas[1]
    const t = concepto
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()

    // Solo productos que no vienen del tarifario retail principal.
    if (!/caucion|echeq|cheque|pagare|factura de credito|\bfci\b|fondos?/.test(t)) {
      return
    }

    const productos = productosDesdeConcepto(concepto)
    if (!productos.length) return

    const parsed = parseTasaComisionTexto(tasaCelda)
    if (parsed.tasa === null) return

    let operacion = 'ambas'
    if (/colocador/.test(t)) operacion = 'colocadora'
    else if (/tomador/.test(t)) operacion = 'tomadora'

    const esCaucion = productos.includes('cauciones')
    const prorrata30 = /prorrata\s+cada\s+30/i.test(tasaCelda)

    for (const producto of productos) {
      filas.push(
        crearComisionBroker({
          entidad: 'ecovalores',
          nombreComercial: 'Eco Valores',
          producto,
          operacion,
          moneda: 'ARS',
          canal: 'web',
          plan: 'no_asesorado',
          tasa: parsed.tasa,
          tasaBase: esCaucion && prorrata30 ? 'mensual' : parsed.tasaBaseHint,
          tasaEsTope: parsed.tasaEsTope || /hasta/i.test(tasaCelda),
          incluyeIva: false,
          ivaAdicional: true,
          prorrateoDias: esCaucion && prorrata30 ? 30 : null,
          enlace: ECO_TARIFARIO_URL,
          metadata: {
            fuenteUrl: ECO_TARIFARIO_URL,
            celdaOriginal: `${concepto} | ${tasaCelda}`,
            notas: esCaucion
              ? 'Tarifas máximas publicadas. Prorrata cada 30 días.'
              : 'Tarifas máximas / FCI del tarifario Eco Valores.',
          },
        }),
      )
    }
  })

  return filas
}

export async function extraerEcoValores() {
  try {
    const respuesta = await axios.get(ECO_TARIFARIO_URL, {
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

    const comisiones = parsearEcoValores(String(respuesta.data))
    logMensaje(log, 'Eco Valores parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
