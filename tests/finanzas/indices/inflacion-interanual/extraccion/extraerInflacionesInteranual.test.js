import { describe, expect, it } from 'vitest'
import { format, subMonths, addMonths } from 'date-fns'
import { extraerInflacionesInteranual } from '@/finanzas/indices/inflacion-interanual/extraccion/extraerInflacionesInteranual.js'

describe('extraerInflacionesInteranual', () => {
  it(
    'extrae la serie de inflación interanual del BCRA',
    async () => {
      const desde = subMonths(new Date(), 3)
      const hasta = addMonths(new Date(), 1)
      const inflaciones = await extraerInflacionesInteranual(
        format(desde, 'yyyy-MM-dd'),
        format(hasta, 'yyyy-MM-dd'),
      )

      expect(inflaciones.length).toBeGreaterThan(0)

      for (const inflacion of inflaciones) {
        expect(inflacion.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof inflacion.valor).toBe('number')
      }
    },
    30000,
  )
})
