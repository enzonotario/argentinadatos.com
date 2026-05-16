import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerLunefi',
  tipo: 'rendimientos',
})

export async function extraerLunefi() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_LUNEFI_URL,
    )

    if (
      !respuesta.data ||
      !respuesta.data.length ||
      !respuesta.data[0].rendimientos.length
    ) {
      return []
    }

    const items = []

    const fecha = format(new Date(), 'yyyy-MM-dd')

    for (const item of respuesta.data[0].rendimientos) {
      if (item.dias !== 1) continue

      const moneda = item.moneda
      const apy = Number((item.apy * 100).toFixed(2))

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
