import { scrapearConFirecrawl } from '@/finanzas/compartido/extraccion/scrapearConFirecrawl.js'
import { logMensaje, logError, logGrupo } from '@/log.js'

export async function extraerSupervielle() {
  const log = logGrupo({
    fuente: 'extraerSupervielle',
    tipo: 'cuentaRemuneradaUsd',
  })

  try {
    const configuracion = {
      url: 'https://www.supervielle.com.ar/personas/cuentas/cuenta-remunerada-dolares',
      prompt:
        'Extrae la tasa de rendimiento anual y el tope máximo de remuneración de la cuenta remunerada en dólares. Para la tasa usa números decimales (por ejemplo 0.035 para 3.5%).',
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

    logMensaje(
      log,
      'Iniciando extracción de cuenta remunerada USD de Supervielle',
    )

    const datos = await scrapearConFirecrawl(log, configuracion)

    if (!datos || typeof datos.tasa !== 'number') {
      throw new Error('Datos inválidos de Supervielle: falta tasa')
    }

    return [
      {
        entidad: 'SUPERVIELLE',
        tasa: datos.tasa,
        tope: datos.tope || null,
      },
    ]
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer datos de Supervielle', {
      errorMessage: error.message,
    })
    return []
  }
}
