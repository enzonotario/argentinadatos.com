import { load } from 'cheerio'
import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'
import { interpretarDecimalConComa } from '@/utils/numeros.js'

export async function extraerMontemarPayCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerMontemarPay',
    tipo: 'cuentaRemunerada',
  })

  try {
    const enlace = 'https://montemarpay.com.ar/'

    const respuesta = await fetch(enlace)

    if (!respuesta.ok) {
      throw new Error(
        `Error al obtener la página de Montemar Pay: ${respuesta.statusText}`,
      )
    }

    const htmlText = await respuesta.text()
    const $ = load(htmlText)

    const textoCompleto = $('body').text()
    const tnaRegex = /(\d+[.,]?\d*)\s*%\s*TNA/i
    const coincidencias = textoCompleto.match(tnaRegex)

    if (!coincidencias || !coincidencias[1]) {
      throw new Error(
        'No se pudo encontrar la tasa TNA en la página de Montemar Pay',
      )
    }

    const tna = Number(
      (interpretarDecimalConComa(coincidencias[1]) / 100).toFixed(4),
    )
    const tea = Number(((1 + tna / 365) ** 365 - 1).toFixed(4))

    return {
      fondo: 'MONTEMAR PAY',
      tna,
      tea,
      tope: null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones: null,
      condicionesCorto: null,
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
