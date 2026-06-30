import { describe, expect, it } from 'vitest'
import {
  URL_NARANJA_X_FRASCOS,
  construirFondoNaranjaXFrascos,
  extraerNaranjaXFrascos,
  normalizarNaranjaXFrascos,
} from '@/finanzas/fci/otros/extraccion/extraerNaranjaXFrascos.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe('construirFondoNaranjaXFrascos', () => {
  it('arma el nombre del fondo según el rango de plazo', () => {
    expect(construirFondoNaranjaXFrascos(7, 13)).toBe('NARANJA X FRASCOS 7-13')
    expect(construirFondoNaranjaXFrascos(28, 28)).toBe('NARANJA X FRASCOS 28')
  })
})

describe('normalizarNaranjaXFrascos', () => {
  it('normaliza tramos por plazo y TNA', () => {
    const resultado = normalizarNaranjaXFrascos({
      tasas: [
        { plazoMinDias: 28, plazoMaxDias: 28, tna: 19 },
        { plazoMinDias: 7, plazoMaxDias: 13, tna: 0.18 },
        { plazoMinDias: 14, plazoMaxDias: 27, tna: 18 },
      ],
      tope: 30000000,
      condiciones: 'Plazo elegible entre 7 y 28 días.',
      condicionesCorto: 'Frascos de 7 a 28 días',
    })

    expect(resultado).toEqual([
      {
        fondo: 'NARANJA X FRASCOS 7-13',
        tna: 0.18,
        tea: 0.1972,
        plazoMinDias: 7,
        plazoMaxDias: 13,
        tope: 30000000,
        condiciones: 'Plazo elegible entre 7 y 28 días.',
        condicionesCorto: 'Frascos de 7 a 28 días',
      },
      {
        fondo: 'NARANJA X FRASCOS 14-27',
        tna: 0.18,
        tea: 0.1972,
        plazoMinDias: 14,
        plazoMaxDias: 27,
        tope: 30000000,
        condiciones: 'Plazo elegible entre 7 y 28 días.',
        condicionesCorto: 'Frascos de 7 a 28 días',
      },
      {
        fondo: 'NARANJA X FRASCOS 28',
        tna: 0.19,
        tea: 0.2092,
        plazoMinDias: 28,
        plazoMaxDias: 28,
        tope: 30000000,
        condiciones: 'Plazo elegible entre 7 y 28 días.',
        condicionesCorto: 'Frascos de 7 a 28 días',
      },
    ])
  })

  it('devuelve null si faltan tramos válidos', () => {
    expect(normalizarNaranjaXFrascos(null)).toBeNull()
    expect(normalizarNaranjaXFrascos({ tasas: [] })).toBeNull()
    expect(
      normalizarNaranjaXFrascos({
        tasas: [{ plazoMinDias: 7, plazoMaxDias: null, tna: 0.18 }],
      }),
    ).toBeNull()
  })
})

describe.skipIf(!tieneFirecrawl)(
  'extraerNaranjaXFrascos (Firecrawl real)',
  () => {
    it('extrae tramos de TNA por plazo desde la web de Naranja X', async () => {
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
    }, 120000)
  },
)
