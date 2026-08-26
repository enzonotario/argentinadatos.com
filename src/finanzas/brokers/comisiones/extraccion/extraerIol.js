import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionBroker,
  parseTasaComisionTexto,
  productosDesdeConcepto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

export const IOL_TARIFAS_URL = 'https://www.invertironline.com/tarifas'

const log = logGrupo({
  fuente: 'extraerIolComisionesBrokers',
  tipo: 'extraccion',
})

const DERECHO_MERCADO_DEFAULT = porcentajeADecimal(0.045, 6)

/**
 * @param {string} titulo
 * @returns {{
 *   productos: string[],
 *   operacion: string,
 *   moneda: string|null,
 *   tasaBase: 'mensual'|null,
 *   prorrateoDias: number|null,
 * }|null}
 */
function clasificarTitulo(titulo) {
  const t = String(titulo)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/cuenta remunerada|fondos comunes|fci\b/.test(t) && !/suscripcion/.test(t)) {
    if (/\bfci\b|fondos comunes/.test(t)) {
      // sección FCI sin tasas en cards → omitir
      return null
    }
    return null
  }

  const productos = productosDesdeConcepto(titulo)
  if (!productos.length) return null

  if (/caucion/.test(t)) {
    if (/colocadora/.test(t) && /peso/.test(t)) {
      return {
        productos: ['cauciones'],
        operacion: 'colocadora',
        moneda: 'ARS',
        tasaBase: 'mensual',
        prorrateoDias: 90,
      }
    }
    if (/colocadora/.test(t) && /dolar/.test(t)) {
      return {
        productos: ['cauciones'],
        operacion: 'colocadora',
        moneda: 'USD',
        tasaBase: 'mensual',
        prorrateoDias: 90,
      }
    }
    if (/tomadora/.test(t)) {
      return {
        productos: ['cauciones'],
        operacion: 'tomadora',
        moneda: null,
        tasaBase: 'mensual',
        prorrateoDias: 90,
      }
    }
    return null
  }

  let operacion = 'ambas'
  if (/^compra\b/.test(t) && !/venta/.test(t)) operacion = 'compra'
  else if (/descuento de cheques/.test(t)) operacion = 'venta'

  return {
    productos,
    operacion,
    moneda: 'ARS',
    tasaBase: null,
    prorrateoDias: null,
  }
}

/**
 * @param {string} textoTarjeta
 * @returns {{ plan: string, celda: string, tasaTexto: string }|null}
 */
function parsearTarjetaPlan(textoTarjeta) {
  const texto = String(textoTarjeta).replace(/\s+/g, ' ').trim()
  const planMatch = texto.match(/^(Gold|Platinum|Black)\*?/i)
  if (!planMatch) return null

  const tasaMatch = texto.match(/([\d]+(?:[.,]\d+)?)\s*%/)
  if (!tasaMatch) return null

  return {
    plan: planMatch[1].toLowerCase(),
    celda: texto,
    tasaTexto: `${tasaMatch[1]}%`,
  }
}

/**
 * @param {string} html
 * @returns {Map<string, number>}
 */
function extraerDerechosMercado(html) {
  const $ = load(html)
  const plano = $('body').text().replace(/\s+/g, ' ')
  /** @type {Map<string, number>} */
  const map = new Map()

  const caucion = plano.match(
    /CAUCIONES[\s\S]{0,120}?(0[,.]045)\s*%/i,
  )
  if (caucion) {
    map.set(
      'cauciones',
      parseTasaComisionTexto(`${caucion[1]}%`).tasa ?? DERECHO_MERCADO_DEFAULT,
    )
  } else {
    const caucionAlt = plano.match(
      /CAUCIONES[\s\S]{0,80}?([\d]+(?:[.,]\d+)?)\s*%/i,
    )
    map.set(
      'cauciones',
      caucionAlt
        ? (parseTasaComisionTexto(`${caucionAlt[1]}%`).tasa ??
          DERECHO_MERCADO_DEFAULT)
        : DERECHO_MERCADO_DEFAULT,
    )
  }

  const acciones = plano.match(
    /ACCIONES Y CEDEARS?\s*([\d]+(?:[.,]\d+)?)\s*%/i,
  )
  if (acciones) {
    const tasa = parseTasaComisionTexto(`${acciones[1]}%`).tasa
    if (tasa !== null) {
      map.set('acciones', tasa)
      map.set('cedears', tasa)
    }
  }

  const bonos = plano.match(/BONOS\s*([\d]+(?:[.,]\d+)?)\s*%/i)
  if (bonos) {
    const tasa = parseTasaComisionTexto(`${bonos[1]}%`).tasa
    if (tasa !== null) map.set('bonos', tasa)
  }

  return map
}

/**
 * @param {string} html
 */
export function parsearIol(html) {
  const $ = load(html)
  const derechos = extraerDerechosMercado(html)
  /** @type {Array<object>} */
  const filas = []

  $('h6').each((_, el) => {
    const titulo = $(el).text().replace(/\s+/g, ' ').trim()
    const clase = clasificarTitulo(titulo)
    if (!clase) return

    const wrap = $(el).parent()
    /** @type {Array<{ plan: string, celda: string, tasaTexto: string }>} */
    const planes = []
    let sib = wrap.next()

    for (let i = 0; i < 3 && sib.length; i++) {
      if (sib.find('h6').length) break
      const tarjeta = parsearTarjetaPlan(sib.text())
      if (tarjeta) planes.push(tarjeta)
      sib = sib.next()
    }

    for (const plan of planes) {
      const parsed = parseTasaComisionTexto(plan.tasaTexto)
      if (parsed.tasa === null) continue

      const monedas = clase.moneda === null ? ['ARS', 'USD'] : [clase.moneda]

      for (const moneda of monedas) {
        for (const producto of clase.productos) {
          filas.push(
            crearComisionBroker({
              entidad: 'iol',
              nombreComercial: 'InvertirOnline',
              producto,
              operacion: clase.operacion,
              moneda,
              canal: 'web',
              plan: plan.plan,
              tasa: parsed.tasa,
              tasaBase: clase.tasaBase,
              tasaEsTope: false,
              incluyeIva: false,
              ivaAdicional: true,
              prorrateoDias: clase.prorrateoDias,
              derechoMercado: derechos.get(producto) ?? null,
              enlace: IOL_TARIFAS_URL,
              metadata: {
                fuenteUrl: IOL_TARIFAS_URL,
                celdaOriginal: plan.celda,
                notas:
                  clase.productos.length > 1
                    ? `Sección unificada «${titulo}»; fila expandida a ${producto}.`
                    : producto === 'cauciones'
                      ? 'Tasa mensual según nota (3) del tarifario. Derecho de mercado BYMA prorrateado cada 90 días.'
                      : `Sección «${titulo}».`,
              },
            }),
          )
        }
      }
    }
  })

  return filas
}

export async function extraerIol() {
  try {
    const respuesta = await axios.get(IOL_TARIFAS_URL, {
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

    const comisiones = parsearIol(String(respuesta.data))
    logMensaje(log, 'IOL parseado', { filas: comisiones.length })
    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}
