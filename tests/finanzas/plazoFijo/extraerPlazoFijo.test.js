import { describe, expect, it } from 'vitest'
import { extraerPlazoFijo } from '@/finanzas/extraccion/extraerPlazoFijo.esjs'

describe('extraerPlazoFijo', () => {
  it('extrae los plazos fijos', async () => {
    const items = await extraerPlazoFijo()

    expect(items).toBeInstanceOf(Array)
    expect(items.length).toBeGreaterThan(0)

    for (const item of items) {
      expect(item).toMatchObject({
        entidad: expect.any(String),
        logo: expect.any(String),
      })
      expect(item.entidad).not.toBe('')
      if (item.tnaClientes !== null) {
        expect(typeof item.tnaClientes).toBe('number')
      }
      if (item.tnaNoClientes !== null) {
        expect(typeof item.tnaNoClientes).toBe('number')
      }
      if (item.enlace !== null) {
        expect(typeof item.enlace).toBe('string')
      }
    }
  }, {
    timeout: 10000,
  })
})
