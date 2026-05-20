import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapearConIA } from '@/finanzas/compartido/extraccion/ia.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

const URL_NARANJA_BLOG_TNA =
  'https://www.naranjax.com/blog/cual-es-la-tna-de-la-cuenta-remunerada-de-naranja-x'

const schemaNaranja = {
  tna: { type: 'number' },
  tope: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  condiciones: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  condicionesCorto: {
    anyOf: [{ type: 'string', maxLength: 200 }, { type: 'null' }],
  },
}

export async function extraerNaranjaX() {
  const log = logGrupo({
    fuente: 'extraerNaranjaX',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await scrapearConIA(log, {
      url: URL_NARANJA_BLOG_TNA,
      fuenteMarkdown: 'defuddle',
      prompt:
        'El markdown es el artículo del blog de Naranja X. Extraé la TNA nominal anual vigente de la cuenta remunerada en pesos, el tope máximo de saldo remunerado si figura (monto en pesos, sin puntos de miles en el número), y un resumen breve de condiciones si aplica. TNA en decimal (ej. 0.19 para 19%). tope null si no se indica límite claro.',
      schema: schemaNaranja,
      required: ['tna', 'tope', 'condiciones', 'condicionesCorto'],
    })

    if (!datos || typeof datos.tna !== 'number') {
      logMensaje(log, 'Naranja X: TNA inválida', { datos })
      throw new Error('Naranja X: falta TNA')
    }

    const tna = redondearTasa(datos.tna)

    return {
      fondo: 'NARANJA X',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: datos.tope === undefined ? null : datos.tope,
      condiciones: datos.condiciones === undefined ? null : datos.condiciones,
      condicionesCorto:
        datos.condicionesCorto === undefined ? null : datos.condicionesCorto,
      fecha: format(new Date(), 'yyyy-MM-dd'),
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer Naranja X', {
      errorMessage: error.message,
    })
    return {}
  }
}
