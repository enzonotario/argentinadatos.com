import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const MACRO_ARANCELES_URL =
  'https://www.macro.com.ar/macrosecurities/documento/1517351172498'

const log = logGrupo({
  fuente: 'extraerMacroSecuritiesComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * Filas de aranceles indicativos con tasa parseable.
 * Omite cauciones (fórmula 1/5 s/TNA), acreencias y CEDINES.
 */
const FILAS_MACRO = [
  {
    labelRe: /Compra\/\s*Venta de T[ií]tulos Privados(?!\s+a Plazo)/i,
    producto: 'acciones',
    ivaAdicional: true,
  },
  {
    labelRe: /Compra\/\s*Venta de T[ií]tulos P[uú]blicos y sus Cupones(?!\s+a Plazo)/i,
    producto: 'bonos',
    ivaAdicional: false,
  },
  {
    labelRe: /Compra\/\s*Venta de Obligaciones Negociables/i,
    producto: 'obligaciones_negociables',
    ivaAdicional: true,
  },
  {
    labelRe: /Compra\/\s*Venta de Opciones en T[ií]tulos Privados/i,
    producto: 'opciones',
    ivaAdicional: true,
  },
  {
    labelRe: /Compra\/\s*Venta de Contratos de Futuros/i,
    producto: 'futuros',
    ivaAdicional: true,
  },
  {
    labelRe: /^Suscripciones\b/im,
    producto: 'licitaciones',
    ivaAdicional: false,
  },
  {
    labelRe: /Negociaci[oó]n de FCA\s*\/\s*CPD(?!\s*-)/i,
    producto: 'cheques',
    ivaAdicional: true,
    tasaBase: 'tna',
  },
]

/**
 * @param {string} texto
 */
export function parsearMacroSecuritiesTexto(texto) {
  const plano = String(texto).replace(/\u00a0/g, ' ')
  /** @type {Array<object>} */
  const filas = []

  const minimoGlobal = parseComisionMinimaTexto(
    plano.match(/Arancel M[ií]nimo\s*(\$\s*[\d.]+)/i)?.[0] || '',
  )

  for (const spec of FILAS_MACRO) {
    const m = plano.match(spec.labelRe)
    if (!m || m.index === undefined) continue

    const ventana = plano.slice(m.index, m.index + 120)
    const tasaMatch = ventana.match(/([\d]+(?:[.,]\d+)?)\s*%/)
    if (!tasaMatch) continue

    const tasaTexto = `${tasaMatch[1]}%${
      /TNA/i.test(ventana.slice(0, tasaMatch.index + 20)) ? ' TNA' : ''
    }`
    const parsed = parseTasaComisionTexto(
      spec.tasaBase === 'tna' ? `${tasaMatch[1]}% TNA` : tasaTexto,
    )
    if (parsed.tasa === null) continue

    filas.push(
      crearComisionBroker({
        entidad: 'macro',
        nombreComercial: 'Macro Securities',
        producto: spec.producto,
        operacion: 'ambas',
        moneda: 'ARS',
        canal: 'web',
        plan: null,
        tasa: parsed.tasa,
        tasaBase: spec.tasaBase ?? parsed.tasaBaseHint,
        tasaEsTope: false,
        incluyeIva: false,
        ivaAdicional: spec.ivaAdicional,
        comisionMinima: minimoGlobal,
        enlace: MACRO_ARANCELES_URL,
        metadata: {
          fuenteUrl: MACRO_ARANCELES_URL,
          celdaOriginal: ventana.replace(/\s+/g, ' ').trim().slice(0, 160),
          notas:
            'Tabla de Aranceles Indicativos. IVA en títulos privados según nota (*). Cauciones omitidas (fórmula 1/5 s/TNA).',
        },
      }),
    )
  }

  return filas
}

export async function extraerMacroSecurities() {
  try {
    const respuesta = await axios.get(MACRO_ARANCELES_URL, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/pdf,*/*',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    const data = await pdf(Buffer.from(respuesta.data))
    const comisiones = parsearMacroSecuritiesTexto(data.text || '')
    logMensaje(log, 'Macro Securities parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
