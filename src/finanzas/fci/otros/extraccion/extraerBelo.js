import axios from 'axios'
import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerBeloCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerBelo',
    tipo: 'cuentaRemunerada',
  })

  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_BELO_CUENTA_REMUNERADA_URL,
    )

    if (!respuesta?.data?.AR?.ARS) {
      logMensaje(log, 'Datos inválidos de Belo API', {
        datos: respuesta.data,
      })
      throw new Error('Error en la respuesta de Belo API')
    }

    const tna = redondearTasa(respuesta.data.AR.ARS)

    if (tna === null) {
      throw new Error('No se encontró el valor de TNA')
    }

    return {
      fondo: 'BELO',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
