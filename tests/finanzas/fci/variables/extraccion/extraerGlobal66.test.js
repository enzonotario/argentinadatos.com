import { describe, expect, it } from 'vitest'
import { extraerGlobal66CuentaRemunerada } from '@/finanzas/fci/variables/extraccion/extraerGlobal66.js'

const tieneGlobal66 =
  Boolean(import.meta.env.VITE_GLOBAL66_API_URL) &&
  Boolean(import.meta.env.VITE_GLOBAL66_API_KEY)

describe.skipIf(!tieneGlobal66)('extraerGlobal66CuentaRemunerada', () => {
  it(
    'extrae Global66 Cuenta Remunerada correctamente',
    async () => {
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
    },
    120000,
  )
})
