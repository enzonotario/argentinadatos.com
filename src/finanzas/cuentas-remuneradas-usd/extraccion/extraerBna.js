import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'
import { logMensaje, logError, logGrupo } from '@/log.js'

export async function extraerBna() {
  const log = logGrupo({
    fuente: 'extraerBna',
    tipo: 'cuentaRemuneradaUsd',
  })

  try {
    const configuracion = {
      url: 'https://www.bna.com.ar/home/cuentaremunerada',
      prompt:
        'Extrae la tasa de rendimiento anual y el tope máximo de remuneración de la cuenta remunerada en dólares. Para la tasa usa números decimales (por ejemplo 0.035 para 3.5%). Si hay múltiples tasas (para distintos rangos de saldo), usa la tasa mínima.',
      schema: {
        tasa: {
          type: 'number',
          description: 'Tasa de rendimiento anual en formato decimal',
        },
        tope: {
          type: 'number',
          description: 'Monto máximo en dólares que se puede remunerar',
        },
      },
      required: ['tasa'],
    }

    const datos = await extractWithAI(log, configuracion)

    if (!datos || typeof datos.tasa !== 'number') {
      throw new Error('Datos inválidos de BNA: falta tasa')
    }

    return [
      {
        entidad: 'BNA',
        tasa: datos.tasa,
        tope: datos.tope || null,
      },
    ]
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer datos de BNA', {
      errorMessage: error.message,
    })
    return []
  }
}
