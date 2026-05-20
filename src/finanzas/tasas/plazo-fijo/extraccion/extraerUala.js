import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export async function extraerUalaPlazoFijo() {
  const log = logGrupo({
    fuente: 'extraerUala',
    tipo: 'plazoFijo',
  })

  try {
    const enlace = 'https://www.uala.com.ar/inversiones/plazo-fijo'
    const respuesta = await fetch(enlace)

    if (!respuesta.ok) {
      throw new Error(
        `Error al obtener la página de Ualá: ${respuesta.statusText}`,
      )
    }

    const htmlText = await respuesta.text()
    const tnaRegex = /TNA\s+30\s+días:\s+(\d+[.,]\d+)%/i
    const coincidencias = htmlText.match(tnaRegex)

    if (!coincidencias || !coincidencias[1]) {
      logMensaje(log, 'No se encontró la tasa TNA en la página de Ualá', {
        htmlText,
      })
      throw new Error('No se pudo encontrar la tasa TNA en la página de Ualá')
    }

    const tna = interpretarDecimalConComa(coincidencias[1]) / 100

    return {
      entidad: 'UALA',
      logo: 'https://icons.com.ar/icons/bancos-apps/uala.svg',
      tnaClientes: tna,
      tnaNoClientes: tna,
      enlace,
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
