import { describe, expect, it } from 'vitest'
import { extraerPlazoFijo } from '@/finanzas/tasas/plazo-fijo/extraccion/extraerPlazoFijo.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe('extraerPlazoFijo', () => {
  it(
    'extrae los plazos fijos',
    async () => {
      const items = await extraerPlazoFijo()

      expect(items).toBeInstanceOf(Array)
      expect(items.length).toBeGreaterThan(0)

      for (const item of items) {
        expect(item).toMatchObject({
          entidad: expect.any(String),
          logo: expect.any(String),
        })
        expect(item.entidad).not.toBe('')
        if (item.tnaClientes !== null) {
          expect(typeof item.tnaClientes).toBe('number')
        }
        if (item.tnaNoClientes !== null) {
          expect(typeof item.tnaNoClientes).toBe('number')
        }
        if (item.enlace !== null) {
          expect(typeof item.enlace).toBe('string')
        }
        if (item.tasas !== undefined && item.tasas !== null) {
          expect(Array.isArray(item.tasas)).toBe(true)
          for (const tramo of item.tasas) {
            expect(typeof tramo.tna).toBe('number')
          }
        }
        if (item.condiciones !== undefined && item.condiciones !== null) {
          expect(typeof item.condiciones).toBe('string')
        }
        if (
          item.condicionesCorto !== undefined &&
          item.condicionesCorto !== null
        ) {
          expect(typeof item.condicionesCorto).toBe('string')
        }
      }

      const voii = items.find(item => item.entidad?.toUpperCase().includes('VOII'))

      expect(voii).toBeDefined()

      if (tieneFirecrawl) {
        expect(voii.tasas).toBeInstanceOf(Array)
        expect(voii.tasas.length).toBeGreaterThanOrEqual(7)
        expect(voii.tasas.some(tramo => tramo.montoMaximo === 999999)).toBe(
          true,
        )
        expect(voii.tasas.some(tramo => tramo.montoMinimo === 1000000)).toBe(
          true,
        )
        expect(
          voii.tasas.some(
            tramo => tramo.plazoMinDias === 45 && tramo.plazoMaxDias === 59,
          ),
        ).toBe(true)
        expect(
          voii.tasas.some(
            tramo => tramo.plazoMinDias === 180 && tramo.plazoMaxDias === null,
          ),
        ).toBe(true)
      }
    },
    tieneFirecrawl ? 120000 : 10000,
  )
})
