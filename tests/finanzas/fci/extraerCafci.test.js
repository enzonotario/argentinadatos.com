import { describe, expect, it } from 'vitest'
import { extraerCafci } from '@/extractores/cafci.extractor.esjs'

describe('extraerCafci', () => {
  it('extrae las series de Cafci', async () => {
    const series = [
      'mercadoDinero',
      'rentaVariable',
      'rentaFija',
      'rentaMixta',
      'retornoTotal',
    ]

    for (const serie of series) {
      const items = await extraerCafci(serie)

      expect(items).toBeDefined()
      expect(items.length).toBeGreaterThan(0)

      for (const item of items) {
        expect(item.fondo).toBeTypeOf('string')
        expect(item.horizonte).toBeTypeOf('string')
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
  }, 1000 * 60 * 5)
})
