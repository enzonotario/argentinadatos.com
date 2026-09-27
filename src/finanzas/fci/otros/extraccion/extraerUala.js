import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

const URL_UALA_CUENTA_REMUNERADA =
  'https://www.uala.com.ar/inversiones/cuenta-remunerada'

function normalizarFondoUala(nombre) {
  const limpio = (nombre || '').toLowerCase().trim()

  if (
    limpio === 'uala' ||
    limpio === 'cuenta remunerada normal' ||
    limpio === 'cuenta-remunerada-normal' ||
    limpio === 'normal'
  ) {
    return 'UALA'
  }

  if (
    limpio === 'uala plus 1' ||
    limpio === 'cuenta remunerada plus 1' ||
    limpio === 'cuenta-remunerada-plus-1' ||
    limpio === 'plus 1'
  ) {
    return 'UALA PLUS 1'
  }

  if (
    limpio === 'uala plus 2' ||
    limpio === 'cuenta remunerada plus 2' ||
    limpio === 'cuenta-remunerada-plus-2' ||
    limpio === 'plus 2'
  ) {
    return 'UALA PLUS 2'
  }

  return null
}

export async function extraerUalaCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerUala',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await extractWithAI(log, {
      url: URL_UALA_CUENTA_REMUNERADA,
      effort: 'min',
      prompt:
        'El markdown proviene de la página pública de Ualá. Extrae las tasas de las cuentas remuneradas Normal y Plus (en los niveles que haya). Para la TNA usa números decimales (por ejemplo 0.75 para 75%). En condiciones copiá textual la condición de cada nivel tal como figura en la página. En condicionesCorto resumila dejando claro qué monto hay que sumar y en qué período, respetando la redacción actual de la página (si dice "este mes", no escribas "el próximo mes"). Los nombres de fondo deben ser exactamente: UALA, UALA PLUS 1, UALA PLUS 2. Formato de ejemplo (los textos son ilustrativos, usá los de la página): [ { "fondo": "UALA", "tna": 0.4, "tope": 1500000, "condiciones": null, "condicionesCorto": null }, { "fondo": "UALA PLUS 1", "tna": 0.45, "tope": 1500000, "condiciones": "<condición textual del nivel Plus 1>", "condicionesCorto": "<resumen de la condición del nivel Plus 1>" }, { "fondo": "UALA PLUS 2", "tna": 0.5, "tope": 1500000, "condiciones": "<condición textual del nivel Plus 2>", "condicionesCorto": "<resumen de la condición del nivel Plus 2>" } ]',
      schema: {
        fondos: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'fondo',
              'tna',
              'tope',
              'condiciones',
              'condicionesCorto',
            ],
            properties: {
              fondo: {
                type: 'string',
                enum: ['UALA', 'UALA PLUS 1', 'UALA PLUS 2'],
              },
              tna: {
                type: 'number',
              },
              tope: {
                type: 'number',
              },
              condiciones: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
              condicionesCorto: {
                anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }],
              },
            },
          },
        },
      },
      required: ['fondos'],
    })

    if (!Array.isArray(datos.fondos) || datos.fondos.length === 0) {
      logMensaje(log, 'Fondos inválidos en respuesta de IA', { datos })
      throw new Error('Error en la respuesta de IA: fondos inválidos')
    }

    return datos.fondos
      .map(fondo => ({
        ...fondo,
        fondo: normalizarFondoUala(fondo.fondo),
      }))
      .filter(fondo => fondo.fondo)
      .map(fondo => ({
        fondo: fondo.fondo,
        tna: redondearTasa(fondo.tna),
        tea: calcularTeaDesdeTna(fondo.tna),
        tope: fondo.tope,
        condiciones: fondo.condiciones,
        condicionesCorto: fondo.condicionesCorto,
        fecha: format(new Date(), 'yyyy-MM-dd'),
      }))
  } catch (error) {
    logError(log, error)
    return []
  }
}
