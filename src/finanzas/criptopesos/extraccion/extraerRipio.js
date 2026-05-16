import { logGrupo, logError, logMensaje } from '@/log.js'
import axios from 'axios'
import { collect } from 'collect.js'
import { apyToTna } from '@/finanzas/criptopesos/apyToTna.js'

export async function extraerRipio() {
  const log = logGrupo({
    fuente: 'extraerRipio',
    tipo: 'criptopesos',
  })

  try {
    const url = import.meta.env.VITE_FINANZAS_RENDIMIENTOS_RIPIO_URL

    if (!url) {
      logMensaje(log, 'Falta VITE_FINANZAS_RENDIMIENTOS_RIPIO_URL')
      return []
    }

    const respuesta = await axios.get(url)

    if (
      !respuesta.data ||
      !respuesta.data.results ||
      !respuesta.data.results.length
    ) {
      logMensaje(log, 'Respuesta vacía o sin results de Ripio API', {
        datos: respuesta.data,
      })
      return []
    }

    const warsItems = collect(respuesta.data.results)
      .flatMap(protocolo =>
        protocolo.assets
          .filter(
            asset => asset.currency && asset.currency.toUpperCase() === 'WARS',
          )
          .map(asset => {
            const apy = Number(asset.apy) || 0
            const tarifaGestion =
              asset.fees && asset.fees.service ? asset.fees.service : 0

            return {
              apy: calcularApy(apy, tarifaGestion),
            }
          }),
      )
      .toArray()

    if (warsItems.length === 0) {
      logMensaje(log, 'No se encontró wARS en Ripio API', {
        datos: respuesta.data,
      })
      return []
    }

    const maximoApy = collect(warsItems).sortByDesc('apy').first().apy

    const apyDecimal = maximoApy / 100

    const n = 365
    const tnaCalculada = apyToTna(apyDecimal, n)
    const tna = Number(tnaCalculada.toFixed(4))

    if (isNaN(tna) || tna < 0) {
      throw new Error('Valor de TNA inválido para Ripio wARS')
    }

    return [
      {
        token: 'wARS',
        entidad: 'RIPIO',
        tna,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}

export function calcularApy(apy, tarifaGestion) {
  const factorAnualBruto = 1 + apy / 100
  const factorFeeAnual = Math.pow(1 - tarifaGestion / 100, 365)
  const factorAnualNeto = factorAnualBruto * factorFeeAnual

  return Number(((factorAnualNeto - 1) * 100).toFixed(2))
}
