import { describe, expect, it } from 'vitest'
import {
  DOCTA_BONOS_CER_URL,
  extraerBonosCer,
} from '@/finanzas/bonosCer/extraccion/extraerBonosCer.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerBonosCer (Firecrawl real)', () => {
  it('extrae filas de soberanos CER desde Docta', async () => {
    expect(DOCTA_BONOS_CER_URL).toContain('doctacapital.com.ar')

    const payload = await extraerBonosCer()
    const bonos = payload.bonos

    expect(payload.fechaActualizacion).toBeTruthy()
    expect(payload.fechaActualizacion).toMatch(/Z$/)
    expect(Array.isArray(bonos)).toBe(true)
    expect(bonos.length).toBeGreaterThan(0)

    const tickers = new Set(bonos.map(b => b.ticker))
    expect(tickers.size).toBe(bonos.length)

    for (const row of bonos) {
      expect(typeof row.ticker).toBe('string')
      expect(row.ticker.length).toBeGreaterThanOrEqual(3)
      expect(row.precioArs).toBeGreaterThan(0)
      expect(row.tirPorcentaje).toBeGreaterThan(-50)
      expect(row.tirPorcentaje).toBeLessThan(200)
      expect(/^\d{4}-\d{2}-\d{2}$/.test(row.fechaVencimiento)).toBe(true)
      expect(row.durationYears).toBeUndefined()
      expect(row.daysToMaturity).toBeUndefined()
      if (row.volumen !== undefined) {
        expect(typeof row.volumen).toBe('number')
        expect(row.volumen).toBeGreaterThanOrEqual(0)
      }
    }

    const conocidos = ['TZX26', 'TX26', 'X13Y6', 'TVYY']
    expect(conocidos.some(t => tickers.has(t))).toBe(true)

    console.log('[extraerBonosCer.real]', bonos.length, 'bonos', {
      muestra: bonos.slice(0, 3),
    })
  }, 120000)
})
