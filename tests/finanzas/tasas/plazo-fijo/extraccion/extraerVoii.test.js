import { describe, expect, it } from 'vitest'
import {
  URL_VOII_PLAZO_FIJO,
  URL_VOII_TASAS_PASIVAS,
  extraerVoiiPlazoFijo,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerVoii.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerVoiiPlazoFijo', () => {
  it(
    'extrae tramos de TNA desde la web de Voii y tasas pasivas',
    async () => {
      expect(URL_VOII_PLAZO_FIJO).toBe('https://www.voii.com.ar/plazo-fijo-web/')
      expect(URL_VOII_TASAS_PASIVAS).toBe(
        'https://www.voii.com.ar/tasas-de-interes-activas/#TasasPFW',
      )

      const resultado = await extraerVoiiPlazoFijo()

      expect(resultado).not.toBeNull()
      expect(Array.isArray(resultado.tasas)).toBe(true)
      expect(resultado.tasas.length).toBeGreaterThanOrEqual(7)

      for (const tramo of resultado.tasas) {
        expect(typeof tramo.tna).toBe('number')
        expect(tramo.tna).toBeGreaterThan(0)
        expect(tramo.tna).toBeLessThan(1)

        for (const campo of [
          'montoMinimo',
          'montoMaximo',
          'plazoMinDias',
          'plazoMaxDias',
        ]) {
          if (tramo[campo] !== null) {
            expect(typeof tramo[campo]).toBe('number')
            expect(tramo[campo]).toBeGreaterThan(0)
          }
        }
      }

      const tramoHasta999999 = resultado.tasas.find(
        tramo => tramo.montoMaximo === 999999,
      )
      const tramoDesde1000000 = resultado.tasas.find(
        tramo => tramo.montoMinimo === 1000000,
      )

      expect(tramoHasta999999).toBeDefined()
      expect(tramoDesde1000000).toBeDefined()
      expect(tramoHasta999999.tna).toBeGreaterThan(0)
      expect(tramoDesde1000000.tna).toBeGreaterThan(tramoHasta999999.tna)

      const tramos30a44 = resultado.tasas.filter(
        tramo => tramo.plazoMinDias === 30 && tramo.plazoMaxDias === 44,
      )
      expect(tramos30a44).toHaveLength(2)

      const tramo45a59 = resultado.tasas.find(
        tramo => tramo.plazoMinDias === 45 && tramo.plazoMaxDias === 59,
      )
      const tramo180oMas = resultado.tasas.find(
        tramo => tramo.plazoMinDias === 180 && tramo.plazoMaxDias === null,
      )

      expect(tramo45a59).toBeDefined()
      expect(tramo180oMas).toBeDefined()
      expect(tramo45a59.tna).toBeGreaterThan(tramo180oMas.tna)

      if (resultado.condiciones) {
        expect(typeof resultado.condiciones).toBe('string')
      }
      if (resultado.condicionesCorto) {
        expect(typeof resultado.condicionesCorto).toBe('string')
        expect(resultado.condicionesCorto.length).toBeLessThanOrEqual(100)
      }
    },
    120000,
  )
})
