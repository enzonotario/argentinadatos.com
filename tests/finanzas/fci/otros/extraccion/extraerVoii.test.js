import { describe, expect, it } from 'vitest'
import {
  URL_VOII_CUENTA_REMUNERADA,
  extraerVoiiCuentaRemunerada,
} from '@/finanzas/fci/otros/extraccion/extraerVoii.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerVoiiCuentaRemunerada', () => {
  it(
    'extrae la TNA de la caja de ahorro remunerada desde la web de Voii',
    async () => {
      expect(URL_VOII_CUENTA_REMUNERADA).toBe(
        'https://www.voii.com.ar/app-mobile/',
      )

      const resultado = await extraerVoiiCuentaRemunerada()

      expect(resultado).toBeDefined()
      expect(Object.keys(resultado).length).toBeGreaterThan(0)
      expect(resultado.fondo).toBe('VOII')
      expect(typeof resultado.tna).toBe('number')
      expect(resultado.tna).toBeGreaterThan(0)
      expect(resultado.tna).toBeLessThan(1)
      expect(typeof resultado.tea).toBe('number')
      expect(resultado.tea).toBeGreaterThan(resultado.tna)
      expect(resultado.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      if (resultado.tope !== null) {
        expect(typeof resultado.tope).toBe('number')
        expect(resultado.tope).toBeGreaterThan(0)
      }

      if (resultado.condiciones) {
        expect(typeof resultado.condiciones).toBe('string')
        expect(resultado.condiciones.length).toBeGreaterThan(10)
      }

      if (resultado.condicionesCorto) {
        expect(typeof resultado.condicionesCorto).toBe('string')
        expect(resultado.condicionesCorto.length).toBeLessThanOrEqual(100)
      }
    },
    120000,
  )
})
