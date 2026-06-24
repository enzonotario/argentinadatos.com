import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export const URL_UALA_PLAZO_FIJO =
  'https://www.uala.com.ar/inversiones/plazo-fijo'

const REGEX_SECCION_TASAS =
  /aria-label="Tasas y porcentajes"[\s\S]*?<\/ul>/i
const REGEX_TRAMO_TNA =
  /<li[^>]*>[\s\S]*?>(\d+[.,]\d+)%<\/span>[\s\S]*?>TNA\s+(\d+)\s+días<\/span>/gi

export function parsearTasasPlazoFijoUala(html) {
  if (!html || typeof html !== 'string') {
    return []
  }

  const seccion = html.match(REGEX_SECCION_TASAS)?.[0] ?? html
  const regexTramo = new RegExp(REGEX_TRAMO_TNA.source, 'gi')
  const tasas = []
  let coincidencia = regexTramo.exec(seccion)

  while (coincidencia) {
    const plazoDias = Number(coincidencia[2])

    if (!Number.isNaN(plazoDias)) {
      tasas.push({
        montoMinimo: null,
        montoMaximo: null,
        plazoMinDias: plazoDias,
        plazoMaxDias: plazoDias,
        tna: interpretarDecimalConComa(coincidencia[1]) / 100,
      })
    }

    coincidencia = regexTramo.exec(seccion)
  }

  return tasas.sort((a, b) => a.plazoMinDias - b.plazoMinDias)
}

export async function extraerUalaPlazoFijo() {
  const log = logGrupo({
    fuente: 'extraerUala',
    tipo: 'plazoFijo',
  })

  try {
    const respuesta = await fetch(URL_UALA_PLAZO_FIJO)

    if (!respuesta.ok) {
      throw new Error(
        `Error al obtener la página de Ualá: ${respuesta.statusText}`,
      )
    }

    const htmlText = await respuesta.text()
    const tasas = parsearTasasPlazoFijoUala(htmlText)

    if (tasas.length === 0) {
      logMensaje(log, 'No se encontraron tasas TNA en la página de Ualá')
      throw new Error('No se pudo encontrar la tasa TNA en la página de Ualá')
    }

    const tna30Dias = tasas.find(tramo => tramo.plazoMinDias === 30)?.tna

    if (tna30Dias === undefined) {
      throw new Error('No se pudo encontrar la tasa TNA a 30 días en Ualá')
    }

    return {
      entidad: 'UALA',
      logo: 'https://icons.com.ar/icons/bancos-apps/uala.svg',
      tnaClientes: tna30Dias,
      tnaNoClientes: tna30Dias,
      enlace: URL_UALA_PLAZO_FIJO,
      tasas,
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
