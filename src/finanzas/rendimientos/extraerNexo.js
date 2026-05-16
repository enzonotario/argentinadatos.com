import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerNexo',
  tipo: 'rendimientos',
})

export async function extraerNexo() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_NEXO_URL,
      {
        headers: {
          'X-Comparatasas-Api-Key': import.meta.env
            .VITE_FINANZAS_RENDIMIENTOS_NEXO_API_KEY,
        },
      },
    )

    const items = []

    const fecha = format(new Date(), 'yyyy-MM-dd')

    const entidad = respuesta.data.find(e => e.entidad === 'Nexo')

    if (!entidad) {
      return []
    }

    for (const item of entidad.rendimientos) {
      const moneda = item.moneda.toUpperCase()
      const apy = Number(item.apy) * 100

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
