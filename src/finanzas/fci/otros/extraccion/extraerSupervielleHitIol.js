import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerSupervielleHitIolCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerSupervielleHitIol',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await extractWithAI(log, {
      url: 'https://www.supervielle.com.ar/personas/cuentas/cuenta-hit-iol',
      prompt:
        'Extrae la TNA (Tasa Nominal Anual) de la cuenta en pesos ("Cuenta en Pesos") para el segmento Clientes Cuenta Hit IOL de la promoción publicada. No uses las tasas de la cuenta en dólares. Para la TNA usá números decimales (por ejemplo 0.20 para 20%). El tope es el monto máximo en pesos remunerable; si indica "sin tope" o no hay límite numérico claro, omití tope o dejalo null.',
      schema: {
        tna: {
          type: 'number',
          description:
            'Tasa Nominal Anual en pesos en formato decimal (ej: 0.20 para 20%)',
        },
        tope: {
          type: 'number',
          description: 'Monto máximo en pesos remunerado, si aplica',
        },
      },
      required: ['tna'],
    })

    if (!datos || typeof datos.tna !== 'number') {
      logMensaje(log, 'Datos inválidos de Supervielle Hit IOL: falta TNA', {
        datos,
      })
      throw new Error('Datos inválidos de Supervielle Hit IOL: falta TNA')
    }

    const tna = redondearTasa(datos.tna)
    const tea = calcularTeaDesdeTna(tna)

    logMensaje(log, 'Extracción de Supervielle Hit IOL exitosa', {
      tna,
      tea,
      tope: datos.tope,
    })

    return {
      fondo: 'SUPERVIELLE HIT IOL',
      tna,
      tea,
      tope: datos.tope || null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones:
        'Cuenta remunerada en pesos para clientes con Cuenta Hit IOL.',
      condicionesCorto: 'Solo Clientes Cuenta Hit IOL.',
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer datos de Supervielle Hit IOL', {
      errorMessage: error.message,
    })
    return []
  }
}
