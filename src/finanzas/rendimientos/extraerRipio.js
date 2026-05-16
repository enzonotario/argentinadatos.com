import { load } from 'cheerio'
import { format } from 'date-fns'
import axios from 'axios'
import { collect } from 'collect.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerRipio',
  tipo: 'rendimientos',
})

export async function extraerRipio() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_RIPIO_URL,
    )

    if (
      !respuesta.data ||
      !respuesta.data.results ||
      !respuesta.data.results.length
    ) {
      return []
    }

    return collect(respuesta.data.results)
      .flatMap(protocolo =>
        protocolo.assets.map(asset => {
          const apy = parseFloat(asset.apy)
          const tarifaGestion = asset.fees ? asset.fees.service : 0

          return {
            moneda: asset.currency,
            apy: calcularApy(apy, tarifaGestion),
            fecha: asset.timestamp.split(' ')[0],
            protocolo: protocolo.name,
            tarifaGestion,
          }
        }),
      )
      .groupBy('moneda')
      .map((valores, key) => {
        const maximoApy = collect(valores).sortByDesc('apy').first()

        return {
          moneda: key,
          apy: maximoApy.apy,
          fecha: maximoApy.fecha,
        }
      })
      .toArray()
  } catch (error) {
    logError(log, error)
    return []
  }
}

function calcularApy(apy, tarifaGestion) {
  const tasaDiaria = Math.pow(1 + apy / 100, 1 / 365) - 1
  const tasaDiariaAjustada = tasaDiaria - tarifaGestion / 100
  const apyAjustado = Math.pow(1 + tasaDiariaAjustada, 365) - 1

  return Number((apyAjustado * 100).toFixed(2))
}
