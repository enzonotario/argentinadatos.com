import { describe, expect, it } from 'vitest'
import { extraerGlobal66CuentaRemunerada } from '@/finanzas/extraccion/extraerGlobal66.esjs'

describe('extraerGlobal66CuentaRemunerada', () => {
  it('extrae Global66 Cuenta Remunerada correctamente', async () => {
    const resultado = await extraerGlobal66CuentaRemunerada()

    expect(resultado).toMatchObject({
      fecha: expect.any(String),
      fondo: 'GLOBAL66',
      tipo: 'billetera',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: null,
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
  }, 500000)
})
