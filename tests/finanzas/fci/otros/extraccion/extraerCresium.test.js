import { describe, expect, it } from 'vitest'
import { extraerCresiumCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerCresium.js'

describe('extraerCresium', () => {
  it(
    'extrae Cresium Cuenta Remunerada correctamente',
    async () => {
      const resultado = await extraerCresiumCuentaRemunerada()

      expect(resultado).toMatchObject({
        fecha: expect.any(String),
        fondo: 'CRESIUM',
        tea: expect.any(Number),
        tna: expect.any(Number),
        tope: null,
        condiciones: null,
        condicionesCorto: 'Solo Personas Jurídicas.',
      })

      // Verificar que TNA sea un número positivo (viene como porcentaje de la API)
      expect(resultado.tna).toBeGreaterThan(0)
      expect(resultado.tna).toBeLessThan(1) // Debe ser decimal (ej: 0.24 para 24%)

      // Verificar que TEA sea un número positivo mayor que TNA
      expect(resultado.tea).toBeGreaterThan(resultado.tna)
    },
    {
      timeout: 10000,
    },
  )
})
