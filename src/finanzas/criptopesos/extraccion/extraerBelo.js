import { logGrupo, logError, logMensaje } from '@/log.js'
import axios from 'axios'

export async function extraerBelo() {
  const log = logGrupo({
    fuente: 'extraerBelo',
    tipo: 'criptopesos',
  })

  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_BELO_CUENTA_REMUNERADA_URL,
    )

    if (
      !respuesta ||
      !respuesta.data ||
      !respuesta.data.AR ||
      !respuesta.data.AR.ARS
    ) {
      logMensaje(log, 'Datos inválidos de Belo API', {
        datos: respuesta.data,
      })
      throw new Error('Error en la respuesta de Belo API')
    }

    const tna = Number(respuesta.data.AR.ARS)

    if (isNaN(tna)) {
      throw new Error('Valor de TNA inválido')
    }

    return [
      {
        token: 'ARGt',
        entidad: 'BELO',
        tna: Number(tna.toFixed(4)),
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}
