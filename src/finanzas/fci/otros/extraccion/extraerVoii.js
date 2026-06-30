import { format } from 'date-fns'
import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

export const URL_VOII_CUENTA_REMUNERADA = 'https://www.voii.com.ar/app-mobile/'

const SCHEMA_VOII_CUENTA_REMUNERADA = {
  tna: { type: 'number' },
  tope: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  condiciones: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  condicionesCorto: {
    anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }],
  },
}

export function normalizarVoiiCuentaRemunerada(datos) {
  if (!datos || typeof datos.tna !== 'number' || Number.isNaN(datos.tna)) {
    return null
  }

  const tna = redondearTasa(datos.tna > 1 ? datos.tna / 100 : datos.tna)

  if (tna === null) {
    return null
  }

  return {
    tna,
    tea: calcularTeaDesdeTna(tna),
    tope:
      typeof datos.tope === 'number' && !Number.isNaN(datos.tope)
        ? datos.tope
        : null,
    condiciones:
      typeof datos.condiciones === 'string' && datos.condiciones.trim() !== ''
        ? datos.condiciones.trim()
        : null,
    condicionesCorto:
      typeof datos.condicionesCorto === 'string' &&
      datos.condicionesCorto.trim() !== ''
        ? datos.condicionesCorto.trim()
        : null,
  }
}

export async function extraerVoiiCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerVoii',
    tipo: 'cuentaRemunerada',
  })

  try {
    const configuracion = {
      url: URL_VOII_CUENTA_REMUNERADA,
      prompt: `Extraé la TNA de la caja de ahorro remunerada de Voii (Banco Voii) en pesos desde la página de app mobile.

La tasa promocional figura como "TNA en pesos(1)" seguida del porcentaje (ej. "TNA en pesos(1) 21%").
En la nota al pie (1) suele decir algo como: "TNA Estimada 21%. Tasa de Interés Nominal Anual (TNA) fija repactable de referencia, vigente desde el 03/02/2025. Sujeta a modificaciones."

Devolvé:
- tna: TNA nominal anual en decimal (ej. 0.21 para 21%)
- tope: saldo máximo remunerado en pesos como entero sin separadores si figura; null si no hay tope claro
- condiciones: texto legal o aclaratorio completo de las notas al pie (1) y (2) sobre la caja de ahorro remunerada, tal como aparece en la página
- condicionesCorto: resumen en menos de 100 caracteres del beneficio (ej. caja de ahorro remunerada sin costo, acreditación mensual)`,
      schema: SCHEMA_VOII_CUENTA_REMUNERADA,
      required: ['tna'],
    }

    logMensaje(log, 'Iniciando extracción de cuenta remunerada Voii')

    const datos = await scrapeWithFirecrawl(log, configuracion)
    const normalizado = normalizarVoiiCuentaRemunerada(datos)

    if (!normalizado) {
      throw new Error('Datos inválidos de Voii: falta TNA')
    }

    logMensaje(log, 'Extracción de cuenta remunerada Voii exitosa', {
      tna: normalizado.tna,
      tea: normalizado.tea,
      tope: normalizado.tope,
    })

    return {
      fondo: 'VOII',
      ...normalizado,
      fecha: format(new Date(), 'yyyy-MM-dd'),
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer cuenta remunerada de Voii', {
      errorMessage: error.message,
    })
    return {}
  }
}
