import { describe, expect, it } from 'vitest'
import {
  extraerRemesas,
} from '@/finanzas/remesas/extraccion/extraerRemesas.esjs'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerRemesas (Firecrawl real)', () => {
  it('extrae tabla de remesas desde dolarito.ar/remotito', async () => {
    const payload = await extraerRemesas()
    const remesas = payload.remesas

    expect(payload.fechaActualizacion).toBeTruthy()
    expect(payload.fechaActualizacion).toMatch(/Z$/)
    expect(Array.isArray(remesas)).toBe(true)
    expect(remesas.length).toBeGreaterThan(0)

    const companias = new Set(remesas.map(r => r.compania))
    expect(companias.size).toBe(remesas.length)

    for (const row of remesas) {
      expect(typeof row.compania).toBe('string')
      expect(row.compania.length).toBeGreaterThan(0)
      expect(typeof row.cuentaPropia).toBe('boolean')
      expect(typeof row.inversiones).toBe('boolean')
      expect(typeof row.tarjetaUsa).toBe('boolean')
    }

    console.log('[extraerRemesas.real]', remesas.length, 'plataformas', {
      muestra: remesas.slice(0, 3),
    })
  }, 120000)
})
