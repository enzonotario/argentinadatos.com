import { describe, expect, it } from 'vitest'
import { extraerPlazoFijoUvaPagoPeriodico } from '@/finanzas/extraccion/extraerPlazoFijoUvaPagoPeriodico.js'

describe('extraerPlazoFijoUvaPagoPeriodico', () => {
  it('extrae proveedores con tasas por plazo (UVA pago periódico)', async () => {
    const proveedores = await extraerPlazoFijoUvaPagoPeriodico()

    expect(proveedores).toBeInstanceOf(Array)
    expect(proveedores.length).toBeGreaterThan(0)

    const bna = proveedores.find(p => p.id === 'bna')
    expect(bna).toBeDefined()
    expect(bna).toMatchObject({
      id: 'bna',
      entidad: expect.any(String),
      logo: expect.any(String),
      tasas: expect.any(Array),
    })
    expect(bna.entidad).toBe('Banco de la Nación Argentina')
    expect(bna.tasas.length).toBeGreaterThan(0)

    for (const tasa of bna.tasas) {
      expect(tasa).toMatchObject({
        nombre: expect.any(String),
        plazoMinDias: expect.any(Number),
        plazoMaxDias: expect.any(Number),
      })
      expect(tasa.plazoMinDias).toBeGreaterThan(0)
      expect(tasa.plazoMaxDias).toBeGreaterThanOrEqual(tasa.plazoMinDias)
      expect(typeof tasa.tna).toBe('number')
      expect(typeof tasa.tea).toBe('number')
      expect(tasa.tna).toBeGreaterThan(0)
      expect(tasa.tea).toBeGreaterThan(0)
    }
  }, {
    timeout: 15000,
  })
})
