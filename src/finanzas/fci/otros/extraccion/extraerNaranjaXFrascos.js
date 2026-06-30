import { format } from 'date-fns'
import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

export const URL_NARANJA_X_FRASCOS = 'https://www.naranjax.com/frascos'

const SCHEMA_NARANJA_X_FRASCOS = {
  tasas: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        plazoMinDias: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        plazoMaxDias: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        tna: { type: 'number' },
      },
      required: ['tna'],
    },
  },
  tope: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  condiciones: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  condicionesCorto: {
    anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }],
  },
}

export function construirFondoNaranjaXFrascos(plazoMinDias, plazoMaxDias) {
  if (plazoMinDias === plazoMaxDias) {
    return `NARANJA X FRASCOS ${plazoMinDias}`
  }

  return `NARANJA X FRASCOS ${plazoMinDias}-${plazoMaxDias}`
}

function normalizarTramoFrasco(tramo) {
  if (!tramo || typeof tramo.tna !== 'number' || Number.isNaN(tramo.tna)) {
    return null
  }

  const plazoMinDias =
    typeof tramo.plazoMinDias === 'number' && !Number.isNaN(tramo.plazoMinDias)
      ? tramo.plazoMinDias
      : null
  const plazoMaxDias =
    typeof tramo.plazoMaxDias === 'number' && !Number.isNaN(tramo.plazoMaxDias)
      ? tramo.plazoMaxDias
      : null

  if (plazoMinDias === null || plazoMaxDias === null) {
    return null
  }

  const tna = redondearTasa(tramo.tna > 1 ? tramo.tna / 100 : tramo.tna)

  if (tna === null) {
    return null
  }

  return {
    fondo: construirFondoNaranjaXFrascos(plazoMinDias, plazoMaxDias),
    tna,
    tea: calcularTeaDesdeTna(tna),
    plazoMinDias,
    plazoMaxDias,
  }
}

export function normalizarNaranjaXFrascos(datos) {
  if (!datos || !Array.isArray(datos.tasas) || datos.tasas.length === 0) {
    return null
  }

  const tope =
    typeof datos.tope === 'number' && !Number.isNaN(datos.tope)
      ? datos.tope
      : null
  const condiciones =
    typeof datos.condiciones === 'string' && datos.condiciones.trim() !== ''
      ? datos.condiciones.trim()
      : null
  const condicionesCorto =
    typeof datos.condicionesCorto === 'string' &&
    datos.condicionesCorto.trim() !== ''
      ? datos.condicionesCorto.trim()
      : null

  const tramos = datos.tasas
    .map(normalizarTramoFrasco)
    .filter(Boolean)
    .sort((a, b) => a.plazoMinDias - b.plazoMinDias)

  if (tramos.length === 0) {
    return null
  }

  return tramos.map(tramo => ({
    ...tramo,
    tope,
    condiciones,
    condicionesCorto,
  }))
}

export async function extraerNaranjaXFrascos() {
  const log = logGrupo({
    fuente: 'extraerNaranjaXFrascos',
    tipo: 'frascos',
  })

  try {
    const configuracion = {
      url: URL_NARANJA_X_FRASCOS,
      prompt: `Extraé las tasas de los Frascos de Naranja X en pesos desde la página de frascos.

La sección "Elegí el plazo de tus frascos" publica tramos por rango de días con su TNA, por ejemplo:
- 7 a 13 días: 18% TNA
- 14 a 27 días: 18% TNA
- 28 días: 19% TNA

Para cada tramo devolvé un elemento en "tasas" con:
- tna: TNA nominal anual en decimal (ej. 0.18 para 18%)
- plazoMinDias y plazoMaxDias: enteros del rango (para "28 días" usá 28 y 28; para "7 a 13 días" usá 7 y 13)

En "tope" incluí el monto máximo de inversión en pesos como entero sin separadores si figura en la página; null si no hay tope claro.
En "condiciones" incluí el texto aclaratorio completo de la sección si figura.
En "condicionesCorto" resumí en menos de 100 caracteres (ej. plazo elegible entre 7 y 28 días).`,
      schema: SCHEMA_NARANJA_X_FRASCOS,
      required: ['tasas'],
    }

    logMensaje(log, 'Iniciando extracción de Frascos Naranja X')

    const datos = await scrapeWithFirecrawl(log, configuracion)
    const normalizado = normalizarNaranjaXFrascos(datos)

    if (!normalizado) {
      throw new Error('Datos inválidos de Naranja X Frascos: faltan tasas')
    }

    const fecha = format(new Date(), 'yyyy-MM-dd')

    logMensaje(log, 'Extracción de Frascos Naranja X exitosa', {
      tramos: normalizado.length,
    })

    return normalizado.map(tramo => ({
      ...tramo,
      fecha,
    }))
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer Frascos de Naranja X', {
      errorMessage: error.message,
    })
    return []
  }
}
