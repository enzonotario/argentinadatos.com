import { escribirRuta, existeRuta, leerRuta } from '@/utils/rutas.js'
import { format, isSameDay, parse } from 'date-fns'
import { collect } from 'collect.js'

export async function guardarDolares(dolares, fecha) {
  const fechaConBarra = format(fecha, 'yyyy/MM/dd')

  const existe = await existeRuta(`/cotizaciones/dolares/${fechaConBarra}`)

  const hoy = new Date()

  const esHoy = isSameDay(fecha, hoy)

  if (existe && !esHoy) {
    return
  }

  escribirRuta(`/cotizaciones/dolares/${fechaConBarra}`, dolares)

  dolares.map(dolar => {
    escribirRuta(`/cotizaciones/dolares/${dolar.casa}/${fechaConBarra}`, dolar)
  })

  collect(dolares)
    .groupBy('casa')
    .map(dolares => {
      guardarHistoricoPorCasa(dolares.first().casa, dolares.toArray(), fecha)
    })

  guardarHistorico(dolares, fecha)
}

function guardarHistoricoPorCasa(casa, dolares, fecha) {
  const actual = leerRuta(`/cotizaciones/dolares/${casa}`)

  const actualSinItemsConMismaFecha = actual.filter(item => {
    const esMismaFecha = isSameDay(
      fecha,
      parse(item.fecha, 'yyyy-MM-dd', new Date()),
    )

    return !esMismaFecha
  })

  const nuevo = [...actualSinItemsConMismaFecha, ...dolares]

  escribirRuta(`/cotizaciones/dolares/${casa}`, nuevo)
}

function guardarHistorico(dolares, fecha) {
  const actual = leerRuta(`/cotizaciones/dolares`)

  const actualSinItemsConMismaFecha = actual.filter(item => {
    const esMismaFecha = isSameDay(
      fecha,
      parse(item.fecha, 'yyyy-MM-dd', new Date()),
    )

    return !esMismaFecha
  })

  const nuevo = [...actualSinItemsConMismaFecha, ...dolares]

  escribirRuta(`/cotizaciones/dolares`, nuevo)
}
