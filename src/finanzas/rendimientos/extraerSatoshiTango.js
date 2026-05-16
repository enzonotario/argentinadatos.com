import { load } from 'cheerio'
import { format } from 'date-fns'
import axios from 'axios'
import { collect } from 'collect.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerSatoshiTango',
  tipo: 'rendimientos',
})

export async function extraerSatoshiTango() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_SATOSHITANGO_URL,
    )

    if (
      !respuesta.data ||
      !respuesta.data.data ||
      !respuesta.data.data.result ||
      !respuesta.data.data.result.length
    ) {
      return []
    }

    return collect(respuesta.data.data.result)
      .map(asset => {
        const apy = parseFloat(asset.apy)

        return {
          moneda: asset.symbol,
          apy,
          fecha: format(new Date(), 'yyyy-MM-dd'),
        }
      })
      .toArray()
  } catch (error) {
    logError(log, error)
    return []
  }
}
