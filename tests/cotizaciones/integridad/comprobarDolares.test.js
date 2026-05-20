import { describe, expect, it } from 'vitest'
import { format, parseISO, startOfDay, addDays, subDays } from 'date-fns'
import { leerRuta, escribirRuta, existeRuta } from '@/utils/rutas.js'
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
          throw new Error(`No se guardó ${dolar.fecha}`)
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

  it('lee `/dolares/index.json` y escribe en cada sub-directorio', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    expect(dolares.length).toBeGreaterThan(0)

    collect(dolares)
      .groupBy('casa')
      .map(async dolaresPorCasa => {
        dolaresPorCasa.map(async dolar => {
          // Guardar
          const guardar = await escribirRuta(
            `/cotizaciones/dolares/${dolar.casa}/${format(
              parseISO(dolar.fecha),
              'yyyy/MM/dd',
            )}`,
            {
              casa: dolar.casa,
              compra: dolar.compra,
              venta: dolar.venta,
              fecha: dolar.fecha,
            },
          )
        })

        await escribirRuta(
          `/cotizaciones/dolares/${dolaresPorCasa.first().casa}`,
          dolaresPorCasa
            .toArray()
            .sort((a, b) => a.casa.localeCompare(b.casa))
            .map(dolar => ({
              casa: dolar.casa,
              compra: dolar.compra,
              venta: dolar.venta,
              fecha: dolar.fecha,
            })),
          true,
        )
      })

    collect(dolares)
      .groupBy('fecha')
      .map(async (dolaresPorFecha, fecha) => {
        const guardar = await escribirRuta(
          `/cotizaciones/dolares/${format(parseISO(fecha), 'yyyy/MM/dd')}`,
          dolaresPorFecha
            .toArray()
            .sort((a, b) => a.casa.localeCompare(b.casa)),
        )
      })
  })

  it('rellena los días faltantes', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    const output = []

    expect(dolares.length).toBeGreaterThan(0)

    const fechas = collect(dolares).pluck('fecha').unique().sort().toArray()

    const primeraFecha = fechas[0]
    const ultimaFecha = fechas[fechas.length - 1]

    const fechaActual = parseISO(primeraFecha)
    const fechaFinal = parseISO(ultimaFecha)

    const fechasFaltantes = []

    while (fechaActual <= fechaFinal) {
      const fecha = format(fechaActual, 'yyyy/MM/dd')

      const existe = await existeRuta(`/cotizaciones/dolares/${fecha}`)

      if (existe) {
        output.push(
          ...collect(dolares)
            .where('fecha', format(fechaActual, 'yyyy-MM-dd'))
            .toArray(),
        )
      } else {
        // Copiar del día anterior

        const fechaCopiada = new Date(fechaActual)

        const agregar = collect(output)
          .where(
            'fecha',
            format(
              new Date(fechaCopiada.setDate(fechaCopiada.getDate() - 1)),
              'yyyy-MM-dd',
            ),
          )
          .map(dolar => ({
            ...dolar,
            fecha: format(fechaActual, 'yyyy-MM-dd'),
          }))
          .toArray()

        output.push(...agregar)

        fechasFaltantes.push({
          fecha: format(fechaActual, 'yyyy-MM-dd'),
          agregar,
        })

        console.log(['Falta', format(fechaActual, 'yyyy-MM-dd'), agregar])
      }

      fechaActual.setDate(fechaActual.getDate() + 1)
    }

    await escribirRuta('/cotizaciones/dolares', output, true)

    expect(fechasFaltantes.length).toBe(0)
  })

  it('prettify', async () => {
    const dolares = await leerRuta('/cotizaciones/dolares')

    await escribirRuta(
      '/cotizaciones/dolares',
      collect(dolares)
        .sortBy('fecha')
        .map(dolar => ({
          casa: dolar.casa,
          compra: dolar.compra,
          venta: dolar.venta,
          fecha: dolar.fecha,
        }))
        .toArray(),
      false,
    )
  })

  it('rellena los dias faltantes por casa', async () => {
    try {
      const finSolidario = '2023-12-13'

      const dolares = await leerRuta('/cotizaciones/dolares')

      const output = []

      expect(dolares.length).toBeGreaterThan(0)

      const casas = collect(dolares).pluck('casa').unique().sort().toArray()

      const fechas = collect(dolares).pluck('fecha').unique().sort().toArray()

      const dolaresCollect = collect(dolares)

      const primeraFecha = fechas[0]
      const ultimaFecha = fechas[fechas.length - 1]

      let fechaActual = parseISO(primeraFecha)
      const fechaFinal = parseISO(ultimaFecha)

      while (fechaActual <= fechaFinal) {
        for (const casa of casas) {
          if (casa === 'solidario' && fechaActual > parseISO(finSolidario)) {
            continue
          }

          const existe = dolaresCollect
            .where('casa', casa)
            .where('fecha', format(fechaActual, 'yyyy-MM-dd'))
            .first()

          if (existe) {
            output.push(existe)
            continue
          }

          const fechaCopiada = new Date(fechaActual)

          const agregar = dolaresCollect
            .where('casa', casa)
            .where(
              'fecha',
              format(subDays(new Date(fechaCopiada), 1), 'yyyy-MM-dd'),
            )
            .map(dolar => ({
              ...dolar,
              fecha: format(fechaActual, 'yyyy-MM-dd'),
            }))
            .toArray()

          output.push(...agregar)
          dolaresCollect.push(...agregar)
        }

        fechaActual = addDays(fechaActual, 1)
      }

      await escribirRuta('/cotizaciones/dolares', output, false)
    } catch (e) {
      console.log(e)
    }
  })
})
