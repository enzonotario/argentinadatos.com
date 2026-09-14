import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const PUENTE_COMISIONES_URL =
  'https://www.puentenet.com/puente/abrirCuentaAction!exportacionComisiones.action'

const log = logGrupo({
  fuente: 'extraerPuenteComisionesBrokers',
  tipo: 'extraccion',
})

/** @type {Array<{ labelRe: RegExp, producto: string, operacion?: string, moneda?: string, productos?: string[], exterior?: boolean }>} */
const FILAS_PUENTE = [
  {
    labelRe: /Acciones - Compra\/Venta(?!\s*del)/i,
    producto: 'acciones',
    moneda: 'ARS',
  },
  {
    labelRe: /Acciones del Exterior e ETFs - Compra\/Venta/i,
    producto: 'acciones',
    moneda: 'USD',
    exterior: true,
  },
  {
    labelRe:
      /Bonos Soberanos - Corporativos -\s*F\.Financieros-\s*Compra\/Venta/i,
    productos: ['bonos', 'obligaciones_negociables'],
    moneda: 'ARS',
  },
  {
    labelRe: /Bonos Soberanos - Corporativos -\s*Compra\/Venta u\$s/i,
    producto: 'bonos',
    moneda: 'USD',
  },
  {
    labelRe: /Cauciones Colocadoras \$/i,
    producto: 'cauciones',
    operacion: 'colocadora',
    moneda: 'ARS',
  },
  {
    labelRe: /Cauciones Colocadoras U\$S/i,
    producto: 'cauciones',
    operacion: 'colocadora',
    moneda: 'USD',
  },
  {
    labelRe: /Cauciones Tomadoras \$/i,
    producto: 'cauciones',
    operacion: 'tomadora',
    moneda: 'ARS',
  },
  {
    labelRe: /Cauciones Tomadoras U\$S/i,
    producto: 'cauciones',
    operacion: 'tomadora',
    moneda: 'USD',
  },
  {
    labelRe: /Cheques de Pago Diferido - Compra\/Venta/i,
    producto: 'cheques',
    moneda: 'ARS',
  },
  {
    labelRe: /Futuros - Compra\/Venta/i,
    producto: 'futuros',
    moneda: 'ARS',
  },
  {
    labelRe: /Licitaci[oó]n \/ Compra\/\s*[Vv]enta de Letras/i,
    producto: 'licitaciones',
    moneda: 'ARS',
  },
  {
    labelRe: /Licitaciones \/ Suscripciones/i,
    producto: 'licitaciones',
    moneda: 'ARS',
  },
  {
    labelRe: /Opciones - Compra\/Venta/i,
    producto: 'opciones',
    moneda: 'ARS',
  },
  {
    labelRe: /Pr[eé]stamos de Valores - Colocador/i,
    producto: 'alquiler_titulos',
    operacion: 'colocadora',
    moneda: 'ARS',
  },
  {
    labelRe: /Pr[eé]stamos de Valores - Tomador/i,
    producto: 'alquiler_titulos',
    operacion: 'tomadora',
    moneda: 'ARS',
  },
]

/**
 * Primera tasa % a la izquierda del label = columna Internet.
 * @param {string} plano
 * @param {number} index
 */
function tasaInternetAntes(plano, index) {
  const ventana = plano.slice(Math.max(0, index - 140), index)
  const rates = [...ventana.matchAll(/([\d]+(?:[.,]\d+)?)\s*%/g)]
  if (!rates.length) return null
  // En el PDF aplanado: ...Internet% Telefónico% Mínimo Label
  // Tomar el penúltimo % (Internet); si hay uno solo, ese.
  const idx = rates.length >= 2 ? rates.length - 2 : 0
  return `${rates[idx][1]}%`
}

/**
 * @param {string} plano
 * @param {number} index
 */
function minimoAntes(plano, index) {
  const ventana = plano.slice(Math.max(0, index - 140), index)
  return (
    parseComisionMinimaTexto(ventana) ??
    (() => {
      const usd = ventana.match(/u\$s\s*([\d.,]+)/i)
      if (!usd) return null
      const n = Number.parseFloat(usd[1].replace(',', '.'))
      return Number.isFinite(n) ? n : null
    })()
  )
}

/**
 * @param {string} texto
 */
export function parsearPuenteTexto(texto) {
  const crudo = String(texto).replace(/\u00a0/g, ' ')
  const corte = crudo.search(
    /Resoluci[oó]n General CNV\s*Comisi[oó]nM[ií]nimoConceptoM[aá]ximo/i,
  )
  const plano = (corte >= 0 ? crudo.slice(0, corte) : crudo).replace(/\s+/g, ' ')

  /** @type {Array<object>} */
  const filas = []

  const derechoAcciones = /Acciones\s+0[,.]06\s*%/i.test(crudo)
    ? porcentajeADecimal(0.06, 6)
    : null
  const derechoBonos = /T[ií]tulos P[uú]blicos\s+0[,.]01\s*%/i.test(crudo)
    ? porcentajeADecimal(0.01, 6)
    : null
  const derechoOpciones = /Opciones\s+0[,.]15\s*%/i.test(crudo)
    ? porcentajeADecimal(0.15, 6)
    : null
  const derechoCauciones = /Cauciones\s*0[,.]03\s*%/i.test(crudo)
    ? porcentajeADecimal(0.03, 6)
    : null

  /** @type {Set<string>} */
  const vistos = new Set()

  for (const spec of FILAS_PUENTE) {
    const m = plano.match(spec.labelRe)
    if (!m || m.index === undefined) continue

    const tasaTexto = tasaInternetAntes(plano, m.index)
    if (!tasaTexto) continue

    const parsed = parseTasaComisionTexto(
      /\+?\s*IVA/i.test(plano.slice(Math.max(0, m.index - 140), m.index))
        ? `${tasaTexto} + IVA`
        : tasaTexto,
    )
    if (parsed.tasa === null) continue

    const productos = spec.productos || [spec.producto]
    const operacion = spec.operacion || 'ambas'
    const moneda = spec.moneda || 'ARS'
    const comisionMinima = minimoAntes(plano, m.index)

    for (const producto of productos) {
      const clave = `${producto}|${operacion}|${moneda}|${spec.exterior ? 'ext' : 'loc'}`
      if (vistos.has(clave)) continue
      vistos.add(clave)

      let derechoMercado = null
      if (producto === 'acciones' && !spec.exterior) derechoMercado = derechoAcciones
      else if (producto === 'bonos' || producto === 'obligaciones_negociables') {
        derechoMercado = derechoBonos
      } else if (producto === 'opciones') derechoMercado = derechoOpciones
      else if (producto === 'cauciones') derechoMercado = derechoCauciones

      filas.push(
        crearComisionBroker({
          entidad: 'puente',
          nombreComercial: 'Puente',
          producto,
          operacion,
          moneda,
          canal: 'web',
          plan: null,
          tasa: parsed.tasa,
          tasaBase: null,
          tasaEsTope: false,
          incluyeIva: false,
          ivaAdicional: parsed.ivaAdicional,
          comisionMinima,
          derechoMercado,
          prorrateoDias: producto === 'cauciones' ? 90 : null,
          enlace: PUENTE_COMISIONES_URL,
          metadata: {
            fuenteUrl: PUENTE_COMISIONES_URL,
            celdaOriginal: `Internet ${tasaTexto} | ${m[0]}`,
            notas: spec.exterior
              ? 'Columna Internet. Mercado exterior / ETFs.'
              : 'Columna Internet (retail). Telefónico omitido.',
            ...(spec.exterior ? { mercado: 'exterior' } : {}),
          },
        }),
      )
    }
  }

  return filas
}

export async function extraerPuente() {
  try {
    const respuesta = await axios.get(PUENTE_COMISIONES_URL, {
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
    const comisiones = parsearPuenteTexto(data.text || '')
    logMensaje(log, 'Puente parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
