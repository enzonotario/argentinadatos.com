import axios from 'axios'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  parseComisionMinimaTexto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'

export const ALLARIA_ARANCELES_URL =
  'https://allariainversiones.com.ar/doc/ArancelesComisiones.pdf'

const log = logGrupo({
  fuente: 'extraerAllariaComisionesBrokers',
  tipo: 'extraccion',
})

/**
 * Filas retail del PDF (autogestión vs asistida).
 * El texto del PDF mezcla columnas; se discrimina por tasa / label.
 * @type {Array<{
 *   labelRe: RegExp,
 *   producto: string,
 *   plan: 'autogestion'|'asistida',
 *   operacion?: string,
 *   moneda?: string,
 *   exterior?: boolean,
 *   prorrateoDias?: number,
 *   tasaEsperada: RegExp,
 *   dualMonedaMin?: boolean,
 *   ivaAdicional?: boolean,
 * }>}
 */
const FILAS_ALLARIA = [
  {
    labelRe: /Compra\/\s*Venta de acciones(?!\s+del)/i,
    producto: 'acciones',
    plan: 'autogestion',
    tasaEsperada: /hasta\s*0[,.]50\s*%/i,
  },
  {
    labelRe: /Compra\/\s*Venta de T[ií]tulos P[uú]blicos/i,
    producto: 'bonos',
    plan: 'autogestion',
    tasaEsperada: /hasta\s*0[,.]25\s*%/i,
  },
  {
    labelRe: /Compra\/\s*Venta de Opciones/i,
    producto: 'opciones',
    plan: 'autogestion',
    tasaEsperada: /hasta\s*0[,.]60\s*%/i,
  },
  {
    labelRe: /Compra\/\s*Venta de Acciones(?!\s+del)/i,
    producto: 'acciones',
    plan: 'asistida',
    tasaEsperada: /hasta\s*1[,.]50\s*%/i,
  },
  {
    labelRe: /Compra\/\s*Venta de Acciones del Exterior/i,
    producto: 'acciones',
    plan: 'asistida',
    moneda: 'USD',
    exterior: true,
    tasaEsperada: /hasta\s*1[,.]50\s*%/i,
  },
  {
    labelRe: /Compra\/\s*Venta de T[ií]tulos P[uú]blicos/i,
    producto: 'bonos',
    plan: 'asistida',
    tasaEsperada: /hasta\s*1[,.]50\s*%/i,
    dualMonedaMin: true,
  },
  {
    labelRe: /Compra\/\s*Venta de T[ií]tulos Privados de renta fija/i,
    producto: 'obligaciones_negociables',
    plan: 'asistida',
    tasaEsperada: /hasta\s*1[,.]50\s*%/i,
    // El PDF aclara "+ IVA (sólo si correspondiere)" fuera de la celda aplanada.
    ivaAdicional: true,
  },
  {
    labelRe: /Compra\/\s*Venta de Opciones/i,
    producto: 'opciones',
    plan: 'asistida',
    tasaEsperada: /hasta\s*2[,.]50\s*%/i,
  },
  {
    labelRe: /Derivados y futuros financieros/i,
    producto: 'futuros',
    plan: 'asistida',
    tasaEsperada: /hasta\s*1[,.]50\s*%/i,
  },
  {
    labelRe: /Cauci[oó]n Burs[aá]til Tomador/i,
    producto: 'cauciones',
    operacion: 'tomadora',
    plan: 'asistida',
    prorrateoDias: 30,
    tasaEsperada: /hasta\s*0[,.]40\s*%/i,
  },
  {
    labelRe: /Cauci[oó]n bursatil Colocador/i,
    producto: 'cauciones',
    operacion: 'colocadora',
    plan: 'asistida',
    prorrateoDias: 30,
    tasaEsperada: /hasta\s*0[,.]20\s*%/i,
  },
]

/**
 * @param {string} ventana
 * @param {'ARS'|'USD'} moneda
 * @returns {number|null}
 */
function minimoEnVentana(ventana, moneda) {
  if (moneda === 'USD') {
    const usd = ventana.match(/(?:USD|U\$S)\s*([\d.,]+)/i)
    if (!usd) return null
    const n = Number.parseFloat(usd[1].replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return parseComisionMinimaTexto(ventana)
}

/**
 * @param {string} texto
 */
export function parsearAllariaTexto(texto) {
  const plano = String(texto).replace(/\u00a0/g, ' ')
  /** @type {Array<object>} */
  const filas = []
  /** @type {Set<string>} */
  const vistos = new Set()

  const dualMinBonos = /M[ií]nimo:\s*\$\s*20\s*o\s*USD\s*10/i.test(plano)

  for (const spec of FILAS_ALLARIA) {
    const matches = [...plano.matchAll(new RegExp(spec.labelRe.source, 'gi'))]
    let elegido = null

    for (const m of matches) {
      if (m.index === undefined) continue
      const ventana = plano.slice(m.index, m.index + 160)
      const tasaMatch = ventana.match(
        /hasta\s*([\d]+(?:[.,]\d+)?)\s*%(\s*\+\s*IVA)?/i,
      )
      if (!tasaMatch || !spec.tasaEsperada.test(tasaMatch[0])) continue
      elegido = { m, ventana, tasaMatch }
      break
    }

    if (!elegido) continue

    const parsed = parseTasaComisionTexto(
      `hasta ${elegido.tasaMatch[1]}%${elegido.tasaMatch[2] ? ' + IVA' : ''}`,
    )
    if (parsed.tasa === null) continue

    const operacion = spec.operacion || 'ambas'
    const monedas =
      spec.dualMonedaMin && dualMinBonos
        ? /** @type {const} */ (['ARS', 'USD'])
        : [spec.moneda || 'ARS']

    for (const moneda of monedas) {
      const clave = `${spec.producto}|${operacion}|${moneda}|${spec.plan}|${spec.exterior ? 'ext' : 'loc'}`
      if (vistos.has(clave)) continue
      vistos.add(clave)

      let comisionMinima = minimoEnVentana(elegido.ventana, moneda)
      if (spec.dualMonedaMin && dualMinBonos && comisionMinima === null) {
        comisionMinima = moneda === 'ARS' ? 20 : 10
      }

      filas.push(
        crearComisionBroker({
          entidad: 'allaria',
          nombreComercial: 'Allaria Inversiones',
          producto: spec.producto,
          operacion,
          moneda,
          canal: 'web',
          plan: spec.plan,
          tasa: parsed.tasa,
          tasaBase: null,
          tasaEsTope: parsed.tasaEsTope,
          incluyeIva: false,
          ivaAdicional:
            spec.ivaAdicional !== undefined
              ? spec.ivaAdicional
              : parsed.ivaAdicional,
          comisionMinima,
          prorrateoDias: spec.prorrateoDias ?? null,
          enlace: ALLARIA_ARANCELES_URL,
          metadata: {
            fuenteUrl: ALLARIA_ARANCELES_URL,
            celdaOriginal: elegido.ventana.replace(/\s+/g, ' ').trim().slice(0, 180),
            notas:
              spec.plan === 'autogestion'
                ? 'Operatoria con autogestión (web sin asesoramiento comercial).'
                : spec.exterior
                  ? 'Operatoria asistida. Acciones del exterior.'
                  : 'Operatoria asistida.',
            ...(spec.exterior ? { mercado: 'exterior' } : {}),
          },
        }),
      )
    }
  }

  return filas
}

export async function extraerAllaria() {
  try {
    const respuesta = await axios.get(ALLARIA_ARANCELES_URL, {
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
    const comisiones = parsearAllariaTexto(data.text || '')
    logMensaje(log, 'Allaria parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
