import { describe, expect, it } from 'vitest'
import { format, parseISO } from 'date-fns'
import { leerRuta, existeRuta } from '@/utils/rutas.js'
import { collect } from 'collect.js'

describe('comprobarDolares', () => {
  it('comprueba que los dolares de `/dolares/index.json` estén guardados en `/dolares/:casa/:fecha/index.json`', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    expect(dolares.length).toBeGreaterThan(0)

    collect(dolares)
      .groupBy('casa')
      .map(async dolaresPorCasa => {
        dolaresPorCasa.map(async dolar => {
          const guardado = await leerRuta(
            `/cotizaciones/dolares/${dolar.casa}/${format(
              parseISO(dolar.fecha),
              'yyyy/MM/dd',
            )}`,
          )

          if (!guardado) {
            throw new Error(`No se guardó ${dolar.casa} ${dolar.fecha}`)
          }

          expect(guardado).toEqual(dolar)
        })
      })
  })

  it('comprueba que los dolares de `/dolares/index.json` estén guardados en `/dolares/:fecha/index.json`', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    expect(dolares.length).toBeGreaterThan(0)

    collect(dolares)
      .groupBy('fecha')
      .map(async (dolaresPorFecha, fecha) => {
        const guardado = await leerRuta(
          `/cotizaciones/dolares/${format(parseISO(fecha), 'yyyy/MM/dd')}`,
        )

        if (!guardado) {
          throw new Error(`No se guardó ${fecha}`)
        }

        const a = JSON.stringify(
          dolaresPorFecha
            .toArray()
            .sort((a, b) => a.casa.localeCompare(b.casa)),
        )

        const b = JSON.stringify(
          guardado.sort((a, b) => a.casa.localeCompare(b.casa)),
        )

        if (a !== b) {
          throw new Error(`No coinciden ${fecha} \n ${a} \n ${b}`)
        }

        expect(a).toEqual(b)
      })
  })

  it('verifica que no haya días faltantes en el rango de fechas', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    expect(dolares.length).toBeGreaterThan(0)

    const fechas = collect(dolares).pluck('fecha').unique().sort().toArray()

    const primeraFecha = parseISO(fechas[0])
    const ultimaFecha = parseISO(fechas[fechas.length - 1])

    const fechasFaltantes = []

    let fechaActual = parseISO(fechas[0])

    while (fechaActual <= ultimaFecha) {
      const fecha = format(fechaActual, 'yyyy-MM-dd')
      const fechaPath = format(fechaActual, 'yyyy/MM/dd')

      const existe = await existeRuta(`/cotizaciones/dolares/${fechaPath}`)

      if (!existe) {
        fechasFaltantes.push(fecha)
      }

      fechaActual.setDate(fechaActual.getDate() + 1)
    }

    if (fechasFaltantes.length > 0) {
      console.log('Días faltantes:', fechasFaltantes.slice(0, 10))
    }

    expect(fechasFaltantes.length).toBe(0)
  })

  it('verifica que el archivo principal esté ordenado por fecha', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    expect(dolares.length).toBeGreaterThan(0)

    const fechas = dolares.map(d => d.fecha)
    const fechasOrdenadas = [...fechas].sort()

    expect(fechas).toEqual(fechasOrdenadas)
  })
})
