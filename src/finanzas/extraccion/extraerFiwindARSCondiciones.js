import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapearConIA } from './ia.js'

export async function extraerFiwindARSCondiciones() {
  const log = logGrupo({
    fuente: 'extraerFiwindARSCondiciones',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await scrapearConIA(log, {
      url: 'https://help.fiwind.io/es/articles/11723346-tus-primeros-pesos-rinden-mas',
      prompt:
        'Extrae las condiciones del rendimiento bonificado respecto a la fecha de vigencia. No extraigas tasas actuales. En condiciones incluí la fecha de vigencia. En condicionesCorto resumilo en menos de 100 caracteres.',
      schema: {
        condiciones: {
          type: 'string',
        },
        condicionesCorto: {
          type: 'string',
          maxLength: 100,
        },
      },
      required: ['condiciones', 'condicionesCorto'],
    })

    if (
      !datos ||
      typeof datos.condiciones !== 'string' ||
      typeof datos.condicionesCorto !== 'string'
    ) {
      logMensaje(
        log,
        'Datos inválidos de Fiwind ARS Condiciones: faltan condiciones',
        {
          datos,
        },
      )
      return null
    }

    logMensaje(log, 'Extracción de Fiwind ARS Condiciones exitosa', {
      condiciones: datos.condiciones,
      condicionesCorto: datos.condicionesCorto,
    })

    return {
      condiciones: datos.condiciones,
      condicionesCorto: datos.condicionesCorto,
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer condiciones de Fiwind ARS', {
      errorMessage: error.message,
    })
    return null
  }
}
