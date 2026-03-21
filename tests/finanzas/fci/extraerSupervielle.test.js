import { describe, expect, it } from 'vitest'
import { extraerSupervielleCuentaRemunerada } from '@/finanzas/extraccion/extraerSupervielle.esjs'

import.meta.env.VITE_FORCE_IA = 'true'

describe('extraerSupervielle', () => {
  it('extrae Supervielle Cuenta Remunerada correctamente', async () => {
    const resultado = await extraerSupervielleCuentaRemunerada()

    expect(resultado).toMatchObject({
      fecha: expect.any(String),
      fondo: 'SUPERVIELLE',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: expect.any(Number),
      condiciones: null,
      condicionesCorto: expect.any(String),
    })
  }, {
    timeout: 500000,
  })
})
