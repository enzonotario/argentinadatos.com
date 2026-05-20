import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { extraerGlobal66CuentaRemunerada } from '@/finanzas/fci/variables/extraccion/extraerGlobal66.js'

describe('extraerGlobal66CuentaRemunerada', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GLOBAL66_API_URL', import.meta.env.VITE_GLOBAL66_API_URL)
    vi.stubEnv('VITE_GLOBAL66_API_KEY', import.meta.env.VITE_GLOBAL66_API_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('extrae Global66 Cuenta Remunerada correctamente', async () => {
    const resultado = await extraerGlobal66CuentaRemunerada()

    expect(resultado).toMatchObject({
      fecha: expect.any(String),
      nombre: 'GLOBAL66',
      fondo: 'Compass Liquidez - Clase A',
      tipo: 'billetera',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: null,
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
  }, 500000)
})
