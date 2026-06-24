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
        if (item.logo !== null && item.logo !== undefined) {
          expect(typeof item.logo).toBe('string')
        }
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
      const uala = items.find(item => item.entidad?.toUpperCase() === 'UALA')
      const galicia = items.find(item =>
        item.entidad?.toUpperCase().includes('GALICIA'),
      )
      const brubank = items.find(item => item.entidad === 'Brubank')

      expect(voii).toBeDefined()
      expect(uala).toBeDefined()
      expect(galicia).toBeDefined()
      expect(brubank).toBeDefined()
      expect(uala.tasas).toBeInstanceOf(Array)
      expect(uala.tasas.length).toBeGreaterThanOrEqual(6)
      expect(
        uala.tasas.some(tramo => tramo.plazoMinDias === 30 && tramo.plazoMaxDias === 30),
      ).toBe(true)
      expect(
        uala.tasas.some(tramo => tramo.plazoMinDias === 365 && tramo.plazoMaxDias === 365),
      ).toBe(true)
      expect(galicia.tasas).toBeInstanceOf(Array)
      expect(
        galicia.tasas.some(tramo => tramo.plazoMinDias === 60 && tramo.plazoMaxDias === 60),
      ).toBe(true)
      expect(
        galicia.tasas.some(tramo => tramo.plazoMinDias === 365 && tramo.plazoMaxDias === 365),
      ).toBe(true)
      expect(galicia.tasas.some(tramo => tramo.plazoMinDias === 30)).toBe(false)
      expect(brubank.tasas).toBeInstanceOf(Array)
      expect(brubank.tasas.length).toBeGreaterThanOrEqual(4)

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
