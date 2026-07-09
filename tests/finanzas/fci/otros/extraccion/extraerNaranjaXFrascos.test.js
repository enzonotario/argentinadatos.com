import { describe, expect, it } from 'vitest'
import {
  URL_NARANJA_X_FRASCOS,
  extraerNaranjaXFrascos,
} from '@/finanzas/fci/otros/extraccion/extraerNaranjaXFrascos.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerNaranjaXFrascos', () => {
  it(
    'extrae tramos de TNA por plazo desde la web de Naranja X',
    async () => {
      expect(URL_NARANJA_X_FRASCOS).toBe('https://www.naranjax.com/frascos')

      const resultado = await extraerNaranjaXFrascos()

      expect(Array.isArray(resultado)).toBe(true)
      expect(resultado.length).toBeGreaterThanOrEqual(3)

      for (const tramo of resultado) {
        expect(typeof tramo.fondo).toBe('string')
        expect(tramo.fondo).toMatch(/^NARANJA X FRASCOS /)
        expect(typeof tramo.tna).toBe('number')
        expect(tramo.tna).toBeGreaterThan(0)
        expect(tramo.tna).toBeLessThan(1)
        expect(typeof tramo.tea).toBe('number')
        expect(tramo.tea).toBeGreaterThan(tramo.tna)
        expect(typeof tramo.plazoMinDias).toBe('number')
        expect(typeof tramo.plazoMaxDias).toBe('number')
        expect(tramo.plazoMinDias).toBeGreaterThan(0)
        expect(tramo.plazoMaxDias).toBeGreaterThanOrEqual(tramo.plazoMinDias)
        expect(tramo.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }

      const tramo7a13 = resultado.find(tramo => tramo.plazoMinDias === 7)
      const tramo14a27 = resultado.find(tramo => tramo.plazoMinDias === 14)
      const tramo28 = resultado.find(
        tramo => tramo.plazoMinDias === 28 && tramo.plazoMaxDias === 28,
      )

      expect(tramo7a13).toBeDefined()
      expect(tramo14a27).toBeDefined()
      expect(tramo28).toBeDefined()
      expect(tramo7a13.plazoMaxDias).toBe(13)
      expect(tramo14a27.plazoMaxDias).toBe(27)
      expect(tramo28.tna).toBeGreaterThanOrEqual(tramo7a13.tna)
    },
    120000,
  )
})
