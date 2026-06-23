import { describe, expect, it } from 'vitest'
import {
  URL_VOII_PLAZO_FIJO,
  extraerVoiiPlazoFijo,
  normalizarVoiiPlazoFijo,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerVoii.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe('normalizarVoiiPlazoFijo', () => {
  it('normaliza tramos con montos y plazos', () => {
    const resultado = normalizarVoiiPlazoFijo({
      tasas: [
        {
          montoMinimo: 1000000,
          montoMaximo: null,
          plazoMinDias: 30,
          plazoMaxDias: 44,
          tna: 0.24,
        },
        {
          montoMinimo: null,
          montoMaximo: 999999,
          plazoMinDias: 30,
          plazoMaxDias: 44,
          tna: 23,
        },
      ],
      condiciones: '(*) TNA de 30 a 44 días de plazo.',
      condicionesCorto: 'TNA de 30 a 44 días',
    })

    expect(resultado).toEqual({
      tasas: [
        {
          montoMinimo: null,
          montoMaximo: 999999,
          plazoMinDias: 30,
          plazoMaxDias: 44,
          tna: 0.23,
        },
        {
          montoMinimo: 1000000,
          montoMaximo: null,
          plazoMinDias: 30,
          plazoMaxDias: 44,
          tna: 0.24,
        },
      ],
      condiciones: '(*) TNA de 30 a 44 días de plazo.',
      condicionesCorto: 'TNA de 30 a 44 días',
    })
  })
})

describe.skipIf(!tieneFirecrawl)('extraerVoiiPlazoFijo (Firecrawl real)', () => {
  it('extrae tramos de TNA desde la web de Voii', async () => {
    expect(URL_VOII_PLAZO_FIJO).toBe('https://www.voii.com.ar/plazo-fijo-web/')

    const resultado = await extraerVoiiPlazoFijo()

    expect(resultado).not.toBeNull()
    expect(Array.isArray(resultado.tasas)).toBe(true)
    expect(resultado.tasas.length).toBeGreaterThanOrEqual(2)

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

    if (resultado.condiciones) {
      expect(typeof resultado.condiciones).toBe('string')
    }
    if (resultado.condicionesCorto) {
      expect(typeof resultado.condicionesCorto).toBe('string')
      expect(resultado.condicionesCorto.length).toBeLessThanOrEqual(100)
    }
  }, 60000)
})
