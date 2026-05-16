import { describe, expect, it } from 'vitest'
import { extraerAstroPay } from '@/finanzas/rendimientos/extraerAstroPay.js'

describe('extraerAstroPay', () => {
  it('extrae AstroPay desde Google Sheets correctamente', async () => {
    const items = await extraerAstroPay()

    expect(items.length).toBeGreaterThan(0)

    for (const item of items) {
      expect(item.moneda).toBeTypeOf('string')
      expect(item.moneda.length).toBeGreaterThan(0)
      expect(item.apy).toBeTypeOf('number')
      expect(item.fecha).toBeTypeOf('string')
      expect(item.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }

    const monedas = items.map(item => item.moneda)
    expect(monedas).toContain('USD')
  }, {
    timeout: 30000,
  })
})

