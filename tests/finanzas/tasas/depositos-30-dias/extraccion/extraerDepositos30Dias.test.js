import { describe, expect, it } from 'vitest'
import { format, subDays, addDays } from 'date-fns'
import { extraerTasasDepositos30Dias } from '@/finanzas/tasas/depositos-30-dias/extraccion/extraerTasasDepositos30Dias.js'

describe('extraerTasasDepositos30Dias', () => {
  it(
    'extrae la serie de depósitos a 30 días del BCRA',
    async () => {
      const items = await extraerTasasDepositos30Dias(
        format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      )

      expect(items.length).toBeGreaterThan(0)

      for (const item of items) {
        expect(item.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof item.valor).toBe('number')
        expect(item.valor).toBeGreaterThan(0)
      }
    },
    30000,
  )
})
