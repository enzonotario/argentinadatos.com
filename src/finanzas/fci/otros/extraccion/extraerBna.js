import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerBnaCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerBna',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await extractWithAI(log, {
      url: 'https://bna.com.ar/Personas/cuentasueldo',
      prompt: `Extraé datos de la Cuenta Remunerada en pesos del BNA (página Cuenta Sueldo).

La TNA y el tope máximo remunerado figuran en el acordeón "Términos y condiciones" (panel #collapseOne4, div.content_legales), dentro del bloque titulado "CUENTA REMUNERADA EN PESOS". Ignorá los demás bloques legales del mismo acordeón (+HOGARES CON BNA, PRÉSTAMOS PREAPROBADOS, CUENTA NACION, FONDOS COMUNES DE INVERSIÓN, etc.).

Devolvé:
- tna: TNA nominal anual en decimal (ej. 0.14 para 14%)
- tope: saldo máximo remunerado en pesos como entero sin separadores (ej. 2000000 para $2.000.000)
- condiciones: texto legal completo y literal del bloque "CUENTA REMUNERADA EN PESOS", incluyendo el título y el párrafo legal tal como aparece (montos, TNA, TEA, vigencia, restricciones de clientes/cuentas, etc.). No resumas ni parafrasees.
- condicionesCorto: resumen en menos de 100 caracteres para qué clientes/cuentas aplica el beneficio`,
      schema: {
        tna: { type: 'number' },
        tope: { type: 'number' },
        condiciones: { type: 'string' },
        condicionesCorto: { type: 'string', maxLength: 100 },
      },
      required: ['tna', 'tope', 'condiciones'],
    })

    if (!datos || typeof datos.tna !== 'number') {
      logMensaje(log, 'Datos inválidos de BNA: falta TNA', { datos })
      throw new Error('Datos inválidos de BNA: falta TNA')
    }

    const tna = redondearTasa(datos.tna)
    const tea = calcularTeaDesdeTna(tna)

    logMensaje(log, 'Extracción de BNA exitosa', {
      tna,
      tea,
      tope: datos.tope,
      condiciones: datos.condiciones,
      condicionesCorto: datos.condicionesCorto,
    })

    return {
      fondo: 'BNA',
      tna,
      tea,
      tope: datos.tope || null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones: datos.condiciones || null,
      condicionesCorto: datos.condicionesCorto || null,
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer datos de BNA', {
      errorMessage: error.message,
    })
    return []
  }
}
