import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapearConIA } from '@/finanzas/compartido/extraccion/ia.js'
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
    const datos = await scrapearConIA(log, {
      url: 'https://bna.com.ar/Personas/cuentasueldo',
      prompt:
        'Extrae la tasa de la cuenta remunerada en pesos en formato JSON. Para la TNA usa números decimales (por ejemplo 0.2 para 2%). En condiciones/condicionesCorto aclará para qué tipo de Cuentas/Clientes es.',
      schema: {
        tna: { type: 'number' },
        tope: { type: 'number' },
        condiciones: { type: 'string' },
        condicionesCorto: { type: 'string', maxLength: 100 },
      },
      required: ['tna', 'tope'],
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
