import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'
import axios from 'axios'

export async function extraerCresiumCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerCresium',
    tipo: 'cuentaRemunerada',
  })

  try {
    const respuesta = await axios.get(import.meta.env.VITE_FINANZAS_CRESIUM_URL)

    if (
      !respuesta ||
      !respuesta.data ||
      !respuesta.data.data ||
      respuesta.data.data.value == null
    ) {
      throw new Error(
        'No se encontró el valor de TNA en la respuesta de la API',
      )
    }

    // El valor viene como porcentaje (ej: 24 para 24%), lo convertimos a decimal
    const valorPorcentaje = Number(respuesta.data.data.value)
    const tna = Number((valorPorcentaje / 100).toFixed(4))

    const tea = Number(((1 + tna / 365) ** 365 - 1).toFixed(4))

    return {
      fondo: 'CRESIUM',
      tna,
      tea,
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
