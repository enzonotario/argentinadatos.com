import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export const URL_VOII_PLAZO_FIJO = 'https://www.voii.com.ar/plazo-fijo-web/'
export const URL_VOII_TASAS_PASIVAS =
  'https://www.voii.com.ar/tasas-de-interes-activas/#TasasPFW'

const PLAZO_FIJO_WEB_MIN_DIAS = 30
const PLAZO_FIJO_WEB_MAX_DIAS = 44

const SCHEMA_TASAS_VOII = {
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
}

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
    .sort((a, b) => {
      const plazoA = a.plazoMinDias ?? 0
      const plazoB = b.plazoMinDias ?? 0

      if (plazoA !== plazoB) {
        return plazoA - plazoB
      }

      return (a.montoMinimo ?? 0) - (b.montoMinimo ?? 0)
    })

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

function esTramoPlazoFijoWeb(tramo) {
  return (
    tramo.plazoMinDias === PLAZO_FIJO_WEB_MIN_DIAS &&
    tramo.plazoMaxDias === PLAZO_FIJO_WEB_MAX_DIAS
  )
}

export function combinarTasasVoii(datosPlazoFijoWeb, datosTasasPasivas) {
  const web = datosPlazoFijoWeb ? normalizarVoiiPlazoFijo(datosPlazoFijoWeb) : null
  const pasivas = datosTasasPasivas
    ? normalizarVoiiPlazoFijo(datosTasasPasivas)
    : null

  if (!web && !pasivas) {
    return null
  }

  if (!web) {
    return pasivas
  }

  if (!pasivas) {
    return web
  }

  const tasasPasivasRestantes = pasivas.tasas.filter(
    tramo => !esTramoPlazoFijoWeb(tramo),
  )

  const condiciones = [web.condiciones, pasivas.condiciones]
    .filter(Boolean)
    .join(' ')

  const tasas = [...web.tasas, ...tasasPasivasRestantes].sort((a, b) => {
    const plazoA = a.plazoMinDias ?? 0
    const plazoB = b.plazoMinDias ?? 0

    if (plazoA !== plazoB) {
      return plazoA - plazoB
    }

    return (a.montoMinimo ?? 0) - (b.montoMinimo ?? 0)
  })

  return {
    tasas,
    condiciones: condiciones || null,
    condicionesCorto: web.condicionesCorto ?? pasivas.condicionesCorto ?? null,
  }
}

export async function extraerVoiiPlazoFijo() {
  const log = logGrupo({
    fuente: 'extraerVoii',
    tipo: 'plazoFijo',
  })

  try {
    const configuracionPlazoFijoWeb = {
      url: URL_VOII_PLAZO_FIJO,
      prompt: `Extraé las tasas del plazo fijo web de Voii (Banco Voii).
Para cada tramo por monto publicado en la página, devolvé un elemento en "tasas" con:
- tna: TNA nominal anual en decimal (ej. 0.23 para 23%)
- montoMinimo y montoMaximo: montos en pesos ARS como número entero sin separadores de miles (ej. 999999 para $999.999, 1000000 para $1.000.000). Usá null si no hay límite en ese extremo ("hasta $X" → montoMaximo=X y montoMinimo null; "desde $X" → montoMinimo=X y montoMaximo null)
- plazoMinDias y plazoMaxDias: si la página indica un rango de días (ej. 30 a 44), incluilos como enteros; si no figura, null
En "condiciones" incluí el texto aclaratorio completo de la página (plazos, asteriscos, etc.).
En "condicionesCorto" resumí en menos de 100 caracteres.`,
      schema: SCHEMA_TASAS_VOII,
      required: ['tasas'],
    }

    const configuracionTasasPasivas = {
      url: URL_VOII_TASAS_PASIVAS,
      prompt: `Extraé las tasas de plazo fijo en pesos de la sección "Tasas de interés pasivas" / "Depósitos" de Voii (Banco Voii), ancla #TasasPFW.
Solo filas de la tabla "Plazo fijo" en depósitos en pesos (columna TNA en pesos). Ignorá caja de ahorros, dólares y plazo fijo UVA.
Para cada rango de plazo publicado, devolvé un elemento en "tasas" con:
- tna: TNA nominal anual en decimal (ej. 0.225 para 22,50%)
- plazoMinDias y plazoMaxDias: enteros del rango (ej. 45 y 59 para "De 45 a 59 días"; para "De 180 o más" usá plazoMinDias=180 y plazoMaxDias=null)
- montoMinimo y montoMaximo: null (esta tabla no discrimina por monto)
En "condiciones" incluí el texto legal o aclaratorio de la sección si figura.
En "condicionesCorto" resumí en menos de 100 caracteres o null si no aplica.`,
      schema: SCHEMA_TASAS_VOII,
      required: ['tasas'],
    }

    logMensaje(log, 'Iniciando extracción de plazo fijo Voii')

    const [resultadoPlazoFijoWeb, resultadoTasasPasivas] =
      await Promise.allSettled([
        scrapeWithFirecrawl(log, configuracionPlazoFijoWeb),
        scrapeWithFirecrawl(log, configuracionTasasPasivas),
      ])

    if (resultadoPlazoFijoWeb.status === 'rejected') {
      logError(log, resultadoPlazoFijoWeb.reason)
      logMensaje(log, 'Falló extracción de plazo fijo web Voii', {
        errorMessage: resultadoPlazoFijoWeb.reason?.message,
      })
    }

    if (resultadoTasasPasivas.status === 'rejected') {
      logError(log, resultadoTasasPasivas.reason)
      logMensaje(log, 'Falló extracción de tasas pasivas Voii', {
        errorMessage: resultadoTasasPasivas.reason?.message,
      })
    }

    const datosPlazoFijoWeb =
      resultadoPlazoFijoWeb.status === 'fulfilled'
        ? resultadoPlazoFijoWeb.value
        : null
    const datosTasasPasivas =
      resultadoTasasPasivas.status === 'fulfilled'
        ? resultadoTasasPasivas.value
        : null

    const normalizado = combinarTasasVoii(datosPlazoFijoWeb, datosTasasPasivas)

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
