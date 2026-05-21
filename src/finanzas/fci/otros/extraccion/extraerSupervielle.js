import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerSupervielleCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerSupervielle',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await extractWithAI(log, {
      url: 'https://www.supervielle.com.ar/personas/cuentas/cuenta-remunerada',
      prompt:
        'Extrae la TNA (Tasa Nominal Anual) y el tope máximo de remuneración de la cuenta remunerada en pesos de Supervielle. Para la TNA usa números decimales (por ejemplo 0.75 para 75%, 0.42 para 42%). El tope es el monto máximo en pesos que se puede remunerar. Si no se especifica un tope, deja el campo vacío.',
      schema: {
        tna: {
          type: 'number',
          description:
            'Tasa Nominal Anual en formato decimal (ej: 0.75 para 75%)',
        },
        tope: {
          type: 'number',
          description: 'Monto máximo en pesos que se puede remunerar',
        },
      },
      required: ['tna'],
    })

    if (!datos || typeof datos.tna !== 'number') {
      logMensaje(log, 'Datos inválidos de Supervielle: falta TNA', { datos })
      throw new Error('Datos inválidos de Supervielle: falta TNA')
    }

    const tna = redondearTasa(datos.tna)
    const tea = calcularTeaDesdeTna(tna)

    logMensaje(log, 'Extracción de Supervielle exitosa', {
      tna,
      tea,
      tope: datos.tope,
    })

    return {
      fondo: 'SUPERVIELLE',
      tna,
      tea,
      tope: datos.tope || null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones: null,
      condicionesCorto: 'Solo Clientes Plan Sueldo.',
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer datos de Supervielle', {
      errorMessage: error.message,
    })
    return []
  }
}
