import { load } from 'cheerio'
import { format } from 'date-fns'
import axios from 'axios'
import { collect } from 'collect.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerLetsbit',
  tipo: 'rendimientos',
})

export async function extraerLetsbit() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_LETSBIT_URL,
    )

    if (!respuesta.data.length) {
      return []
    }

    const itemsConApy = collect(respuesta.data)
      .where('strategies.0.apy_rate', '>=', 0)
      .toArray()

    const items = []

    const fecha = format(new Date(), 'yyyy-MM-dd')

    for (const item of itemsConApy) {
      const moneda = item.ticker_id.toUpperCase()
      const apy = Number(item.strategies[0].apy_rate)

      items.push({
        moneda,
        apy,
        fecha,
      })
    }

    return items
  } catch (error) {
    logError(log, error)
    return []
  }
}
