import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extractWithAI } from '@/shared/extraction/ai/extractWithAI.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

const URL_REBA_BLOG_CUENTA_REMUNERADA =
  'https://blog.reba.com.ar/cuenta-remunerada-reba-tasa-minimo-y-tope/'

const schemaReba = {
  tna: { type: 'number' },
  tope: { anyOf: [{ type: 'number' }, { type: 'null' }] },
}

export async function extraerRebaCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerReba',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await extractWithAI(log, {
      url: URL_REBA_BLOG_CUENTA_REMUNERADA,
      effort: 'min',
      prompt:
        'El markdown es el artículo del blog de Reba sobre su cuenta remunerada. Extraé la TNA nominal anual vigente de la cuenta remunerada en pesos y el tope máximo de saldo remunerado si figura (monto en pesos, sin puntos de miles en el número). TNA en decimal (ej. 0.19 para 19%). tope null si no se indica límite claro.',
      schema: schemaReba,
      required: ['tna', 'tope'],
    })

    if (!datos || typeof datos.tna !== 'number' || datos.tna <= 0) {
      logMensaje(log, 'Reba: TNA inválida', { datos })
      throw new Error('Reba: falta TNA')
    }

    const tna = redondearTasa(datos.tna)

    return {
      fondo: 'REBA',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: datos.tope === undefined ? null : datos.tope,
      condiciones: null,
      condicionesCorto: null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer Reba', {
      errorMessage: error.message,
    })
    return {}
  }
}
