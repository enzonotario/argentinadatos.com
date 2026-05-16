import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerDolares',
  tipo: 'extraccion',
})

export async function extraerDolares() {
  try {
    const respuesta = await fetch('https://dolarapi.com/v1/dolares')

    const dolares = await respuesta.json()

    const hoy = new Date()

    return dolares.map(dolar => ({
      casa: dolar.casa,
      compra: dolar.compra,
      venta: dolar.venta,
      fecha: format(hoy, 'yyyy-MM-dd'),
    }))
  } catch (error) {
    logError(log, error)
    throw error
  }
}
