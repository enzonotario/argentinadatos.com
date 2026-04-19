import { describe, expect, it } from 'vitest'
import { extraerCacfi } from '@/extractores/cacfi.extractor.esjs'
import { format, subDays } from 'date-fns'

describe('extraerCacfi', () => {
  it('extrae las series de Cacfi', async () => {
      const series = [
        'mercadoDinero',
        'rentaVariable',
        'rentaFija',
        'rentaMixta',
        'retornoTotal',
      ]

      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

      for (const serie of series) {
        const items = await extraerCacfi(serie, yesterday)

        expect(items).toBeDefined()

        for (const item of items) {
          if (item.fondo) {
            expect(item.fondo).toBeTypeOf('string')
          }
          if (item.horizonte) {
            expect(['corto', 'medio', 'largo', 'flex']).toContain(item.horizonte)
          }
          if (item.fecha) {
            expect(item.fecha).toBeTypeOf('string')
          }
          if (item.vcp) {
            expect(item.vcp).toBeTypeOf('number')
          }
          if (item.ccp) {
            expect(item.ccp).toBeTypeOf('number')
          }
          if (item.patrimonio) {
            expect(item.patrimonio).toBeTypeOf('number')
          }
        }

        if (items.length) {
          // Ensure at least some items have all properties
          const itemsWithAllProperties = items.filter((item) => {
            return item.fondo
              && item.horizonte
              && item.fecha
              && item.vcp
              && item.ccp
              && item.patrimonio
          })
          expect(itemsWithAllProperties.length).toBeGreaterThan(0)
        }
      }
  }, {
    timeout: 1000 * 60 * 5, // 5 minutes
  })
})
