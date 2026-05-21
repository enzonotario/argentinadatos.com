import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapearConIA } from '@/finanzas/compartido/extraccion/scrapearConIA.js'
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
    const datos = await scrapearConIA(log, {
      url: URL_UALA_CUENTA_REMUNERADA,
      fuenteMarkdown: 'defuddle',
      prompt:
        'El markdown proviene de la página pública de Ualá. Extrae las tasas de las cuentas remuneradas Normal y Plus (en los niveles que haya). Para la TNA usa números decimales (por ejemplo 0.75 para 75%). En condicionesCorto asegúrate de que quede claro que monto se debe consumir para acceder a la cuenta Plus. Los nombres de fondo deben ser exactamente: UALA, UALA PLUS 1, UALA PLUS 2. Por ejemplo: [ { "fondo": "UALA", "tna": 0.4, "tope": 1500000, "fecha": "2025-09-19" }, { "fondo": "UALA PLUS 1", "tna": 0.45, "tope": 1500000, "condiciones": "Si acumulás $250.000 o más entre ciertas operaciones este mes, el próximo tu tasa sube 3%", "condicionesCorto": "Acumulá $250.000 entre inversiones y consumos para acceder a la tasa Plus 1 el próximo mes", "fecha": "2025-09-19" }, { "fondo": "UALA PLUS 2", "tna": 0.5, "tope": 1500000, "condiciones": "Si acumulás $500.000 o más entre ciertas operaciones este mes, el próximo tu tasa sube 5%", "condicionesCorto": "Acumulá $500.000 entre inversiones y consumos para acceder a la tasa Plus 2 el próximo mes", "fecha": "2025-09-19" } ]',
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
