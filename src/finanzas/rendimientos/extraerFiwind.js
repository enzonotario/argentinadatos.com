import { load } from 'cheerio'
import { format, parseISO } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerFiwind',
  tipo: 'rendimientos',
})

export async function extraerFiwind() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_FIWIND_URL,
    )

    const items = []

    for (const item of respuesta.data) {
      const moneda = item.currency.toUpperCase()
      const apy = Number(item.apy)
      const fecha = format(parseISO(item.updatedAt), 'yyyy-MM-dd')

      items.push({
        moneda,
        apy,
        fecha,
        bonusValue: Number(item.bonusValue),
        bonusThreshold: item.bonusThreshold,
      })
    }

    return items
  } catch (error) {
    logError(log, error)
    return []
  }
}
