import { load } from 'cheerio'
import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import {
  calcularTeaDesdeTna,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

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

    const textoCompleto = load(await respuesta.text())('body').text()
    const coincidencias = textoCompleto.match(/(\d+[.,]?\d*)\s*%\s*TNA/i)

    if (!coincidencias?.[1]) {
      throw new Error(
        'No se pudo encontrar la tasa TNA en la página de Montemar Pay',
      )
    }

    const tna = redondearTasa(interpretarDecimalConComa(coincidencias[1]) / 100)

    return {
      fondo: 'MONTEMAR PAY',
      tna,
      tea: calcularTeaDesdeTna(tna),
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
