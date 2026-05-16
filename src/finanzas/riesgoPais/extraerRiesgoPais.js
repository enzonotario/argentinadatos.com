import axios from 'axios'
import { format, subDays, addDays, isBefore as esAntes, parse } from 'date-fns'
import { escribirRuta, leerRuta } from '@/utils/rutas.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerRiesgoPais',
  tipo: 'extraccion',
})

export async function extraerRiesgoPais(desde, hasta) {
  try {
    const respuesta = await axios.get(
      `https://mercados.ambito.com/riesgopais/historico-general/${format(desde, 'yyyy-MM-dd')}/${format(hasta, 'yyyy-MM-dd')}`,
    )

    const items = []

    for (const item of respuesta.data) {
      if (item[0] === 'Fecha') {
        continue
      }

      items.push({
        valor: parseFloat(item[1]),
        fecha: format(parse(item[0], 'dd-MM-yyyy', new Date()), 'yyyy-MM-dd'),
      })
    }

    return items
  } catch (error) {
    logError(log, error)
    return []
  }
}
