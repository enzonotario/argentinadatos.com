import { load } from 'cheerio'
import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerBelo',
  tipo: 'rendimientos',
})

export async function extraerBelo() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_BELO_URL,
    )

    if (!respuesta.data || !respuesta.data.length) {
      return []
    }

    const items = []

    const fecha = format(new Date(), 'yyyy-MM-dd')

    for (const item of respuesta.data) {
      const moneda = item.currency.toUpperCase()
      const apy = Number(item.rate) * 100

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
