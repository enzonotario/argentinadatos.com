import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { guardarCafci } from '@/finanzas/fci/cafci/guardado/guardarCafci.js'
import { format, parseISO } from 'date-fns'

describe('guardarCafci', () => {
  it(
    'guarda las series de Cafci',
    async () => {
      const fecha = parseISO('2026-04-16')
      const fechaConBarra = format(fecha, 'yyyy/MM/dd')
      const items = [
        {
          fondo: 'Fondo de prueba',
          horizonte: 'medio',
          fecha: '2026-04-16',
          vcp: 123,
          ccp: 456,
          patrimonio: 789,
        },
      ]

      const series = [
        'mercadoDinero',
        'rentaVariable',
        'rentaFija',
        'rentaMixta',
        'retornoTotal',
      ]

      for (const serie of series) {
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
