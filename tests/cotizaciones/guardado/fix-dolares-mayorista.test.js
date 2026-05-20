import { describe, expect, it } from 'vitest'
import { format, parse } from 'date-fns'
import { extraerDolares } from '@/cotizaciones/extraccion/extraerDolares.js'
import { guardarDolares } from '@/cotizaciones/guardado/guardarDolares.js'
import { leerRuta, escribirRuta } from '@/utils/rutas.js'

const dolares = [
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 982.5,
    venta: 985.5,
    fecha: '2024-10-23',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 984,
    venta: 987,
    fecha: '2024-10-24',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 985,
    venta: 988,
    fecha: '2024-10-25',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 985,
    venta: 988,
    fecha: '2024-10-26',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 985,
    venta: 988,
    fecha: '2024-10-27',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 985.5,
    venta: 988.5,
    fecha: '2024-10-28',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 986,
    venta: 989,
    fecha: '2024-10-29',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 987,
    venta: 990,
    fecha: '2024-10-30',
  },
  {
    moneda: 'USD',
    casa: 'mayorista',
    nombre: 'Mayorista',
    compra: 989,
    venta: 992,
    fecha: '2024-10-31',
  },
]

it.skip('corregir mayorista', async () => {
  for (const dolar of dolares) {
    const date = parse(dolar.fecha, 'yyyy-MM-dd', new Date())

    const guardado = await leerRuta(
      `/cotizaciones/dolares/${format(date, 'yyyy/MM/dd')}`,
    )

    escribirRuta(
      `/cotizaciones/dolares/${format(date, 'yyyy/MM/dd')}`,
      guardado.map(g => {
        if (g.casa === dolar.casa) {
          g.compra = dolar.compra
          g.venta = dolar.venta
        }

        return g
      }),
    )

    escribirRuta(
      `/cotizaciones/dolares/mayorista/${format(date, 'yyyy/MM/dd')}`,
      {
        casa: 'mayorista',
        compra: dolar.compra,
        venta: dolar.venta,
        fecha: format(date, 'yyyy-MM-dd'),
      },
    )

    escribirRuta(
      `/cotizaciones/dolares`,
      (await leerRuta(`/cotizaciones/dolares`)).map(g => {
        if (g.fecha === dolar.fecha && g.casa === dolar.casa) {
          g.compra = dolar.compra
          g.venta = dolar.venta
        }

        return g
      }),
    )

    escribirRuta(
      `/cotizaciones/dolares/mayorista`,
      (await leerRuta(`/cotizaciones/dolares/mayorista`)).map(g => {
        if (g.fecha === dolar.fecha && g.casa === dolar.casa) {
          g.compra = dolar.compra
          g.venta = dolar.venta
        }

        return g
      }),
    )
  }
})
