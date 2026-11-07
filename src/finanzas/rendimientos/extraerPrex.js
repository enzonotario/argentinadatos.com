import { load } from 'cheerio'
import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPrex',
  tipo: 'rendimientos',
})

export const PREX_URL = 'https://www.prexcard.com.ar/rendimiento-en-dolares'

/**
 * Convierte el texto de tasa de Prex ("2%", "2,00%") a número.
 *
 * @param {unknown} valor
 * @returns {number|null}
 */
export function parsearTasaPrex(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null
  }

  if (typeof valor !== 'string') {
    return null
  }

  const tasa = Number(valor.replace('%', '').replace(',', '.').trim())

  if (!Number.isFinite(tasa) || tasa < 0) {
    return null
  }

  return Number(tasa.toFixed(2))
}

/**
 * Extrae la tasa desde el JSON de Next.js (`__NEXT_DATA__`) o, como
 * fallback, desde el texto visible de la página.
 *
 * @param {string} html
 * @returns {number|null}
 */
export function parsearRendimientoPrex(html) {
  const $ = load(html)

  const nextData = $('script#__NEXT_DATA__').text()

  if (nextData) {
    try {
      const data = JSON.parse(nextData)
      const usdRate = data?.props?.pageProps?.usdRate
      const tasa = parsearTasaPrex(usdRate)

      if (tasa !== null) {
        return tasa
      }
    } catch {
      // La página pudo cambiar el formato del JSON; probamos con el texto.
    }
  }

  const texto = $('body').text()
  const coincidencia = texto.match(/tasa anual del\s+([\d.,]+)\s*%/i)

  if (coincidencia) {
    return parsearTasaPrex(coincidencia[1])
  }

  return null
}

export async function extraerPrex() {
  try {
    const respuesta = await axios.get(PREX_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      },
    })

    const apy = parsearRendimientoPrex(respuesta.data)

    if (apy === null) {
      logMensaje(log, 'No se pudo encontrar la tasa de rendimiento en USD')
      return []
    }

    return [
      {
        moneda: 'USD',
        apy,
        fecha: format(new Date(), 'yyyy-MM-dd'),
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}
