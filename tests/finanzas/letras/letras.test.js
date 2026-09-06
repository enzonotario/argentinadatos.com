import { describe, expect, it } from 'vitest'
import {
  DOCTA_LETRAS_URL,
  extraerLetras,
} from '@/finanzas/letras/extraccion/extraerLetras.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerLetras (Firecrawl real)', () => {
  it('extrae filas de soberanos tasa fija desde Docta', async () => {
    expect(DOCTA_LETRAS_URL).toContain('docta.com.ar')
    expect(DOCTA_LETRAS_URL).toContain('fixed-rate')

    const payload = await extraerLetras()
    const letras = payload.letras

    expect(payload.fechaActualizacion).toBeTruthy()
    expect(payload.fechaActualizacion).toMatch(/Z$/)
    expect(Array.isArray(letras)).toBe(true)
    expect(letras.length).toBeGreaterThan(0)

    const tickers = new Set(letras.map(l => l.ticker))
    expect(tickers.size).toBe(letras.length)

    for (const row of letras) {
      expect(typeof row.ticker).toBe('string')
      expect(row.ticker.length).toBeGreaterThanOrEqual(3)
      expect(row.precioArs).toBeGreaterThan(0)
      expect(row.tnaPorcentaje).toBeGreaterThan(-50)
      expect(row.tnaPorcentaje).toBeLessThan(500)
      expect(row.teaPorcentaje).toBeGreaterThan(-50)
      expect(row.teaPorcentaje).toBeLessThan(500)
      expect(row.temPorcentaje).toBeGreaterThan(-50)
      expect(row.temPorcentaje).toBeLessThan(100)
      expect(/^\d{4}-\d{2}-\d{2}$/.test(row.fechaVencimiento)).toBe(true)
      expect(row.vpv).toBeUndefined()
      expect(row.fechaEmision).toBeUndefined()
      if (row.volumen !== undefined) {
        expect(typeof row.volumen).toBe('number')
        expect(row.volumen).toBeGreaterThanOrEqual(0)
      }
      if (row.diasAlVencimiento !== undefined) {
        expect(typeof row.diasAlVencimiento).toBe('number')
        expect(row.diasAlVencimiento).toBeGreaterThanOrEqual(0)
      }
      if (row.paridadPorcentaje !== undefined) {
        expect(typeof row.paridadPorcentaje).toBe('number')
      }
      if (row.variacionPorcentaje !== undefined) {
        expect(typeof row.variacionPorcentaje).toBe('number')
      }
    }

    const conocidos = ['S15S6', 'TTS26', 'S30S6', 'TO26', 'T30A7']
    expect(conocidos.some(t => tickers.has(t))).toBe(true)

    console.log('[extraerLetras.real]', letras.length, 'letras', {
      muestra: letras.slice(0, 3),
    })
  }, 120000)
})
