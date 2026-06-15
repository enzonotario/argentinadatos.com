import { logGrupo, logError, logMensaje } from '@/log.js'
import axios from 'axios'

export async function extraerBelo() {
  const log = logGrupo({
    fuente: 'extraerBelo',
    tipo: 'criptopesos',
  })

  try {
    const url = import.meta.env.VITE_FINANZAS_RENDIMIENTOS_BELO_URL

    if (!url) {
      logMensaje(log, 'Falta VITE_FINANZAS_RENDIMIENTOS_BELO_URL')
      return []
    }

    const respuesta = await axios.get(url)

    if (!respuesta.data || !respuesta.data.length) {
      logMensaje(log, 'Respuesta vacía de Belo API', {
        datos: respuesta.data,
      })
      return []
    }

    const argt = respuesta.data.find(item => item.currency === 'ARGt')

    if (!argt) {
      logMensaje(log, 'No se encontró ARGt en Belo API', {
        datos: respuesta.data,
      })
      return []
    }

    const tna = Number(Number(argt.rate).toFixed(4))

    if (isNaN(tna) || tna < 0) {
      throw new Error('Valor de TNA inválido para Belo ARGt')
    }

    return [
      {
        token: 'ARGt',
        entidad: 'BELO',
        tna,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}
