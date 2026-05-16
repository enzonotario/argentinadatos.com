import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerLucaMoney',
  tipo: 'rendimientos',
})

export async function extraerLucaMoney() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_LUCAMONEY_URL,
    )

    if (!respuesta.data || !respuesta.data.data) {
      return []
    }

    const items = []
    const fecha = format(new Date(), 'yyyy-MM-dd')
    const data = respuesta.data.data

    const moneda = data.asset.toUpperCase()
    const apy = Number(data.apy_luca)

    items.push({
      moneda,
      apy,
      fecha,
    })

    return items
  } catch (error) {
    logError(log, error)
    return []
  }
}
