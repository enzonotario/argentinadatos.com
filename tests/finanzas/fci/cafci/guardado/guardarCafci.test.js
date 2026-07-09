import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { extraerCafci } from '@/finanzas/fci/cafci/extraccion/extraerCafci.js'
import { guardarCafci } from '@/finanzas/fci/cafci/guardado/guardarCafci.js'
import { format, parseISO } from 'date-fns'

describe('guardarCafci', () => {
  it(
    'extrae y guarda las series de Cafci',
    async () => {
      const series = [
        'mercadoDinero',
        'rentaVariable',
        'rentaFija',
        'rentaMixta',
        'retornoTotal',
      ]

      for (const serie of series) {
        const items = await extraerCafci(serie)

        expect(items.length).toBeGreaterThan(0)

        const fecha = parseISO(items[0].fecha)
        const fechaConBarra = format(fecha, 'yyyy/MM/dd')
        const esperado = await guardarCafci(serie, items, fecha)

        expect(esperado).toBeDefined()

        const guardado = await leerRuta(
          `/finanzas/fci/${serie}/${fechaConBarra}`,
        )

        for (const item of items) {
          expect(guardado).toContainEqual(item)
        }
      }
    },
    1000 * 60 * 5,
  )
})
