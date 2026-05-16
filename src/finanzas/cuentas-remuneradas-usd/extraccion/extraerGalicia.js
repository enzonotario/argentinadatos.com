import { scrapearConIA } from '@/finanzas/extraccion/ia.js'
import { logMensaje, logError, logGrupo } from '@/log.js'

export async function extraerGalicia() {
  const log = logGrupo({
    fuente: 'extraerGalicia',
    tipo: 'cuentaRemuneradaUsd',
  })

  try {
    const configuracion = {
      url: 'https://www.galicia.ar/personas/beneficios-dolares',
      prompt:
        'Extrae la tasa de rendimiento anual y el tope máximo de remuneración (no de extracción) de la cuenta remunerada en dólares. Para la tasa usa números decimales (por ejemplo 0.035 para 3.5%).',
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

    const datos = await scrapearConIA(log, configuracion)

    if (!datos || typeof datos.tasa !== 'number') {
      throw new Error('Datos inválidos de Galicia: falta tasa')
    }

    return [
      {
        entidad: 'GALICIA',
        tasa: datos.tasa,
        tope: datos.tope || null,
      },
    ]
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer datos de Galicia', {
      errorMessage: error.message,
    })
    return []
  }
}
