import { logGrupo, logError, logMensaje } from '@/log.js'
import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'

export async function extraerFiwindARSCondiciones() {
  const log = logGrupo({
    fuente: 'extraerFiwindARSCondiciones',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await extractWithAI(log, {
      url: 'https://help.fiwind.io/es/articles/11723346-tus-primeros-pesos-rinden-mas',
      prompt:
        'Extrae el aviso sobre la vigencia de la bonificación: el texto que aclara si tiene fecha de vigencia garantizada o si puede ser modificada o descontinuada (suele empezar con "Tené en cuenta que esta bonificación..."). No extraigas tasas, montos ni la fecha de inicio de la promoción. En condiciones copiá ese aviso textual. En condicionesCorto resumí ese mismo aviso en menos de 100 caracteres.',
      schema: {
        condiciones: { type: 'string' },
        condicionesCorto: { type: 'string', maxLength: 100 },
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
        { datos },
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
