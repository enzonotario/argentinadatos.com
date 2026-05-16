import { logGrupo, logError, logMensaje } from '@/log.js'
import axios from 'axios'
import { apyToTna } from '@/finanzas/criptopesos/apyToTna.js'

export async function extraerCapyfi() {
  const log = logGrupo({
    fuente: 'extraerCapyfi',
    tipo: 'criptopesos',
  })

  try {
    const baseUrl = import.meta.env.VITE_FINANZAS_CAPYFI_API_URL
    const token = import.meta.env.VITE_FINANZAS_CAPYFI_TOKEN
    const chainId = import.meta.env.VITE_FINANZAS_CAPYFI_CHAIN_ID || '1'

    const cTokenAddress =
      import.meta.env.VITE_FINANZAS_CAPYFI_CTOKEN_ADDRESS ||
      '0xf80eeec09f417Fa7FCc4A848Ef03af9dF2658d7B'

    if (!baseUrl || !token) {
      logMensaje(
        log,
        'Faltan VITE_FINANZAS_CAPYFI_API_URL o VITE_FINANZAS_CAPYFI_TOKEN',
      )
      return []
    }

    const url = `${baseUrl}?chainId=${chainId}&cTokenAddress=${encodeURIComponent(cTokenAddress)}`

    const respuesta = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!respuesta || !respuesta.data) {
      logMensaje(log, 'Respuesta vacía de Capyfi API', {
        datos: respuesta ? respuesta.data : undefined,
      })
      throw new Error('Error en la respuesta de Capyfi API')
    }

    const data = respuesta.data
    let apyRaw = data.totalApy

    if (apyRaw === undefined || apyRaw === null) apyRaw = data.baseApy

    if (apyRaw === undefined || apyRaw === null) apyRaw = data.apy

    if (apyRaw === undefined || apyRaw === null) apyRaw = data.supplyApy

    if (apyRaw === undefined || apyRaw === null) apyRaw = data.supply_apy

    if (apyRaw === undefined || apyRaw === null) apyRaw = data.marketApy

    if (apyRaw === undefined || apyRaw === null) apyRaw = data.market_apy

    if (apyRaw === undefined || apyRaw === null) {
      logMensaje(log, 'Datos inválidos de Capyfi API: no se encontró APY', {
        datos: data,
      })
      throw new Error('Error en la respuesta de Capyfi API: APY no encontrado')
    }

    let apy = Number(apyRaw)

    if (apy > 1) {
      apy = apy / 100
    }

    if (isNaN(apy) || apy < 0) {
      throw new Error('Valor de APY/TNA inválido')
    }

    const segundosPorAnio = 365 * 24 * 60 * 60
    const slotSeconds = 12.04
    const n = segundosPorAnio / slotSeconds

    const tna = apyToTna(apy, n)

    const tnaRedondeada = Number(tna.toFixed(4))

    return [
      {
        token: 'wARS',
        entidad: 'CAPYFI',
        tna: tnaRedondeada,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}
