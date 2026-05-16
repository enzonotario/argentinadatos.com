import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerCotizaciones',
  tipo: 'extraccion',
})

export async function extraerCotizaciones() {
  try {
    const monedas = ['brl', 'clp', 'eur', 'usd', 'uyu']

    const cotizaciones = await Promise.all(
      monedas.map(moneda =>
        fetch(`https://dolarapi.com/v1/cotizaciones/${moneda}`).then(
          respuesta => respuesta.json(),
        ),
      ),
    )

    const hoy = new Date()

    return cotizaciones.map(cotizacion => ({
      moneda: cotizacion.moneda,
      casa: cotizacion.casa,
      compra: cotizacion.compra,
      venta: cotizacion.venta,
      fecha: format(hoy, 'yyyy-MM-dd'),
    }))
  } catch (error) {
    logError(log, error)
    throw error
  }
}
