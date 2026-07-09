import { describe, expect, it } from 'vitest'
import { format, subMonths, addMonths } from 'date-fns'
import { extraerInflaciones } from '@/finanzas/indices/inflacion/extraccion/extraerInflaciones.js'

describe('extraerInflaciones', () => {
  it(
    'extrae la serie de inflación mensual del BCRA',
    async () => {
      const desde = subMonths(new Date(), 3)
      const hasta = addMonths(new Date(), 1)
      const inflaciones = await extraerInflaciones(
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
