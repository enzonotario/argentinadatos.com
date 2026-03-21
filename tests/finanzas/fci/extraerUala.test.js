import { describe, expect, it } from 'vitest'
import { extraerUalaCuentaRemunerada } from '@/finanzas/extraccion/extraerUala.esjs'

import.meta.env.VITE_FORCE_IA = 'true'

describe('extraerUala', () => {
  it('extrae Uala Cuenta Remunerada correctamente', async () => {
    const resultado = await extraerUalaCuentaRemunerada()

    expect(resultado.length).toBe(3)
    expect(resultado[0]).toMatchObject({
      fecha: expect.any(String),
      fondo: 'UALA',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: expect.any(Number),
    })
    expect(resultado[1]).toMatchObject({
      fecha: expect.any(String),
      fondo: 'UALA PLUS 1',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: expect.any(Number),
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
  }, {
    timeout: 300000,
  })
})
