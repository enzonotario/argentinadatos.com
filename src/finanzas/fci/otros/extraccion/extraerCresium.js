import axios from 'axios'
import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'
import {
  calcularTeaDesdeTna,
  porcentajeADecimal,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerCresiumCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerCresium',
    tipo: 'cuentaRemunerada',
  })

  try {
    const respuesta = await axios.get(import.meta.env.VITE_FINANZAS_CRESIUM_URL)

    if (!respuesta?.data?.data || respuesta.data.data.value == null) {
      throw new Error(
        'No se encontró el valor de TNA en la respuesta de la API',
      )
    }

    const tna = porcentajeADecimal(respuesta.data.data.value)

    return {
      fondo: 'CRESIUM',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones: null,
      condicionesCorto: 'Solo Personas Jurídicas.',
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
