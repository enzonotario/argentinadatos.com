import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export const URL_VOII_PLAZO_FIJO = 'https://www.voii.com.ar/plazo-fijo-web/'

function normalizarTramo(tramo) {
  if (!tramo || typeof tramo.tna !== 'number' || Number.isNaN(tramo.tna)) {
    return null
  }

  const tna = tramo.tna > 1 ? tramo.tna / 100 : tramo.tna

  return {
    montoMinimo:
      typeof tramo.montoMinimo === 'number' && !Number.isNaN(tramo.montoMinimo)
        ? tramo.montoMinimo
        : null,
    montoMaximo:
      typeof tramo.montoMaximo === 'number' && !Number.isNaN(tramo.montoMaximo)
        ? tramo.montoMaximo
        : null,
    plazoMinDias:
      typeof tramo.plazoMinDias === 'number' && !Number.isNaN(tramo.plazoMinDias)
        ? tramo.plazoMinDias
        : null,
    plazoMaxDias:
      typeof tramo.plazoMaxDias === 'number' && !Number.isNaN(tramo.plazoMaxDias)
        ? tramo.plazoMaxDias
        : null,
    tna,
  }
}

export function normalizarVoiiPlazoFijo(datos) {
  if (!datos || !Array.isArray(datos.tasas) || datos.tasas.length === 0) {
    return null
  }

  const tasas = datos.tasas
    .map(normalizarTramo)
    .filter(Boolean)
    .sort((a, b) => (a.montoMinimo ?? 0) - (b.montoMinimo ?? 0))

  if (tasas.length === 0) {
    return null
  }

  return {
    tasas,
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

export async function extraerVoiiPlazoFijo() {
  const log = logGrupo({
    fuente: 'extraerVoii',
    tipo: 'plazoFijo',
  })

  try {
    const configuracion = {
      url: URL_VOII_PLAZO_FIJO,
      prompt: `Extraé las tasas del plazo fijo web de Voii (Banco Voii).
Para cada tramo por monto publicado en la página, devolvé un elemento en "tasas" con:
- tna: TNA nominal anual en decimal (ej. 0.23 para 23%)
- montoMinimo y montoMaximo: montos en pesos ARS como número entero sin separadores de miles (ej. 999999 para $999.999, 1000000 para $1.000.000). Usá null si no hay límite en ese extremo ("hasta $X" → montoMaximo=X y montoMinimo null; "desde $X" → montoMinimo=X y montoMaximo null)
- plazoMinDias y plazoMaxDias: si la página indica un rango de días (ej. 30 a 44), incluilos como enteros; si no figura, null
En "condiciones" incluí el texto aclaratorio completo de la página (plazos, asteriscos, etc.).
En "condicionesCorto" resumí en menos de 100 caracteres.`,
      schema: {
        tasas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              montoMinimo: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              montoMaximo: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              plazoMinDias: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
              plazoMaxDias: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
              tna: { type: 'number' },
            },
            required: ['tna'],
          },
        },
        condiciones: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        condicionesCorto: {
          anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }],
        },
      },
      required: ['tasas'],
    }

    logMensaje(log, 'Iniciando extracción de plazo fijo Voii')

    const datos = await scrapeWithFirecrawl(log, configuracion)
    const normalizado = normalizarVoiiPlazoFijo(datos)

    if (!normalizado) {
      throw new Error('Datos inválidos de Voii: faltan tasas')
    }

    logMensaje(log, 'Extracción de plazo fijo Voii exitosa', {
      tramos: normalizado.tasas.length,
    })

    return normalizado
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer plazo fijo de Voii', {
      errorMessage: error.message,
    })
    return null
  }
}
