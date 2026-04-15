import { describe, expect, it } from 'vitest'
import { extraerFiwindARS } from '@/finanzas/extraccion/extraerFiwindARS.esjs'

describe('extraerFiwindARS', () => {
  it('extrae FiwindARS Cuenta Remunerada correctamente', async () => {
    const resultado = await extraerFiwindARS()

    expect(resultado).toMatchObject({
      fecha: expect.any(String),
      fondo: 'FIWIND',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: resultado.tope ? expect.any(Number) : null,
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
  }, 500000)
})
