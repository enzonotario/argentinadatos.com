import { describe, expect, it } from 'vitest'
import {
  URL_VOII_CUENTA_REMUNERADA,
  extraerVoiiCuentaRemunerada,
  normalizarVoiiCuentaRemunerada,
} from '@/finanzas/fci/otros/extraccion/extraerVoii.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe('normalizarVoiiCuentaRemunerada', () => {
  it('normaliza TNA en decimal y porcentaje', () => {
    expect(
      normalizarVoiiCuentaRemunerada({
        tna: 0.21,
        tope: null,
        condiciones:
          '(1) TNA Estimada 21%. Tasa de Interés Nominal Anual (TNA) fija repactable de referencia, vigente desde el 03/02/2025. Sujeta a modificaciones.',
        condicionesCorto: 'Caja de ahorro remunerada sin costo',
      }),
    ).toEqual({
      tna: 0.21,
      tea: 0.2336,
      tope: null,
      condiciones:
        '(1) TNA Estimada 21%. Tasa de Interés Nominal Anual (TNA) fija repactable de referencia, vigente desde el 03/02/2025. Sujeta a modificaciones.',
      condicionesCorto: 'Caja de ahorro remunerada sin costo',
    })

    expect(
      normalizarVoiiCuentaRemunerada({
        tna: 21,
        tope: null,
        condiciones: null,
        condicionesCorto: null,
      }),
    ).toMatchObject({
      tna: 0.21,
      tea: 0.2336,
      tope: null,
      condiciones: null,
      condicionesCorto: null,
    })
  })

  it('devuelve null si falta TNA válida', () => {
    expect(normalizarVoiiCuentaRemunerada(null)).toBeNull()
    expect(normalizarVoiiCuentaRemunerada({ tna: '21' })).toBeNull()
    expect(normalizarVoiiCuentaRemunerada({ tna: Number.NaN })).toBeNull()
  })
})

describe.skipIf(!tieneFirecrawl)(
  'extraerVoiiCuentaRemunerada (Firecrawl real)',
  () => {
    it('extrae la TNA de la caja de ahorro remunerada desde la web de Voii', async () => {
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
    }, 120000)
  },
)
