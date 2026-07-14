import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerBerry',
  tipo: 'rendimientos',
})

export async function extraerBerry() {
  try {
    const url = import.meta.env.VITE_FINANZAS_RENDIMIENTOS_BERRY_URL
    const token = import.meta.env.VITE_FINANZAS_RENDIMIENTOS_BERRY_TOKEN

    if (!url || !token) {
      logMensaje(
        log,
        'Faltan VITE_FINANZAS_RENDIMIENTOS_BERRY_URL o VITE_FINANZAS_RENDIMIENTOS_BERRY_TOKEN',
      )
      return []
    }

    const respuesta = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!respuesta.data || respuesta.data.apy === undefined) {
      return []
    }

    const fecha = format(new Date(), 'yyyy-MM-dd')
    const apy = Number((Number(respuesta.data.apy) * 100).toFixed(2))

    if (isNaN(apy) || apy < 0) {
      return []
    }

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
