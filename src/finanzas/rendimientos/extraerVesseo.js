import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerVesseo',
  tipo: 'rendimientos',
})

export async function extraerVesseo() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_VESSEO_URL,
    )

    if (!respuesta.data || respuesta.data.apy === undefined) {
      return []
    }

    const fecha = format(new Date(), 'yyyy-MM-dd')
    const apy = Number(respuesta.data.apy) * 100

    return [
      {
        moneda: 'USDC',
        apy,
        fecha,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}
