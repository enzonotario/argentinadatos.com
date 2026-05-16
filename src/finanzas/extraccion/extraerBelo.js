import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import axios from 'axios'

export async function extraerBeloCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerBelo',
    tipo: 'cuentaRemunerada',
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

    const valorTNA = Number(respuesta.data.AR.ARS)

    if (valorTNA === null || isNaN(valorTNA)) {
      throw new Error('No se encontró el valor de TNA')
    }

    const tna = Number(valorTNA.toFixed(4))

    const tea = Number(((1 + tna / 365) ** 365 - 1).toFixed(4))

    return {
      fondo: 'BELO',
      tna,
      tea,
      tope: null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
