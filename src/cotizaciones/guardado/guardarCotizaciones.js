import { escribirRuta, existeRuta, leerRuta } from '@/utils/rutas.js'
import { format, isSameDay, parse } from 'date-fns'
import { collect } from 'collect.js'

export async function guardarCotizaciones(cotizaciones, fecha) {
  const fechaConBarra = format(fecha, 'yyyy/MM/dd')

  const existe = await existeRuta(`/cotizaciones/${fechaConBarra}`)

  const hoy = new Date()

  const esHoy = isSameDay(fecha, hoy)

  if (existe && !esHoy) {
    return
  }

  escribirRuta(`/cotizaciones/${fechaConBarra}`, cotizaciones)

  cotizaciones.map(cotizacion => {
    escribirRuta(
      `/cotizaciones/${cotizacion.moneda.toLowerCase()}/${fechaConBarra}`,
      cotizacion,
    )
  })

  collect(cotizaciones)
    .groupBy('moneda')
    .map((cotizaciones, moneda) => {
      guardarHistoricoPorMoneda(moneda.toLowerCase(), cotizaciones, fecha)
    })

  guardarHistorico(cotizaciones, fecha)
}

function guardarHistoricoPorMoneda(moneda, cotizaciones, fecha) {
  const actual = leerRuta(`/cotizaciones/${moneda}`)

  const actualSinItemsConMismaFecha = actual.filter(item => {
    const esMismaFecha = isSameDay(
      fecha,
      parse(item.fecha, 'yyyy-MM-dd', new Date()),
    )

    return !esMismaFecha
  })

  const nuevo = [...actualSinItemsConMismaFecha, ...cotizaciones]

  escribirRuta(`/cotizaciones/${moneda}`, nuevo)
}

function guardarHistorico(cotizaciones, fecha) {
  const actual = leerRuta(`/cotizaciones`)

  const actualSinItemsConMismaFecha = actual.filter(item => {
    const esMismaFecha = isSameDay(
      fecha,
      parse(item.fecha, 'yyyy-MM-dd', new Date()),
    )

    return !esMismaFecha
  })

  const nuevo = [...actualSinItemsConMismaFecha, ...cotizaciones]

  escribirRuta(`/cotizaciones`, nuevo)
}
