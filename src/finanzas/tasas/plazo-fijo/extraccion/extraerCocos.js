import axios from 'axios'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export const URL_COCOS_PLAZO_FIJO_RATES =
  'https://api.cocos.capital/api2/public/plazo-fijo/rates'

export const URL_COCOS_PLAZO_FIJO = 'https://cocos.capital/'

export const COCOS_LOGO =
  'https://api.argentinadatos.com/static/logos/cocos.png'

const HEADER_BOT_ID = 'x-cocos-external-botid'

/**
 * @returns {string|null}
 */
export function getCocosExternalBotId() {
  const valor = import.meta.env.VITE_COCOS_EXTERNAL_BOTID
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return limpio || null
}

/**
 * @param {unknown} payload
 * @returns {Array<{
 *   montoMinimo: null,
 *   montoMaximo: null,
 *   plazoMinDias: number,
 *   plazoMaxDias: number,
 *   tna: number,
 * }>}
 */
export function parsearTasasPlazoFijoCocos(payload) {
  const traditional =
    payload && typeof payload === 'object' ? payload.traditional : null

  if (!traditional || typeof traditional !== 'object') {
    return []
  }

  /** @type {Array<{ montoMinimo: null, montoMaximo: null, plazoMinDias: number, plazoMaxDias: number, tna: number }>} */
  const tasas = []

  for (const [plazoRaw, tasaRaw] of Object.entries(traditional)) {
    const plazoDias = Number(plazoRaw)
    if (!Number.isFinite(plazoDias) || plazoDias <= 0) continue
    if (tasaRaw === null || tasaRaw === undefined) continue

    const tna = porcentajeADecimal(tasaRaw)
    if (tna === null || tna <= 0) continue

    tasas.push({
      montoMinimo: null,
      montoMaximo: null,
      plazoMinDias: plazoDias,
      plazoMaxDias: plazoDias,
      tna,
    })
  }

  return tasas.sort((a, b) => a.plazoMinDias - b.plazoMinDias)
}

/**
 * @param {object} payload
 */
export function mapearCocosPlazoFijo(payload) {
  const tasas = parsearTasasPlazoFijoCocos(payload)
  if (!tasas.length) return null

  const tna30 =
    tasas.find(tramo => tramo.plazoMinDias === 30)?.tna ?? tasas[0].tna

  return {
    entidad: 'Cocos',
    logo: COCOS_LOGO,
    tnaClientes: tna30,
    tnaNoClientes: tna30,
    enlace: URL_COCOS_PLAZO_FIJO,
    tasas,
  }
}

export async function extraerCocosPlazoFijo() {
  const log = logGrupo({
    fuente: 'extraerCocosPlazoFijo',
    tipo: 'plazoFijo',
  })

  try {
    const botId = getCocosExternalBotId()
    if (!botId) {
      logMensaje(log, 'Falta VITE_COCOS_EXTERNAL_BOTID')
      return null
    }

    const respuesta = await axios.get(URL_COCOS_PLAZO_FIJO_RATES, {
      timeout: 25000,
      headers: {
        Accept: 'application/json',
        [HEADER_BOT_ID]: botId,
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      },
    })

    const item = mapearCocosPlazoFijo(respuesta.data)
    if (!item) {
      throw new Error('Cocos plazo fijo sin tasas parseables')
    }

    logMensaje(log, 'Extracción de plazo fijo Cocos exitosa', {
      tramos: item.tasas.length,
      tna30: item.tnaClientes,
    })
    return item
  } catch (error) {
    logError(log, error)
    return null
  }
}
