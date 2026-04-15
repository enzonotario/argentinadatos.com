import { describe, expect, it } from 'vitest'
import { extraerFiwindARSCondiciones } from '@/finanzas/extraccion/extraerFiwindARSCondiciones.esjs'

describe('extraerFiwindARSCondiciones', () => {
  it('extrae condiciones de Fiwind ARS', async () => {
    const resultado = await extraerFiwindARSCondiciones()

    expect(resultado).toMatchObject({
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
    expect(resultado.condiciones.length).toBeGreaterThan(0)
    expect(resultado.condicionesCorto.length).toBeGreaterThan(0)
  }, 500000)
})
