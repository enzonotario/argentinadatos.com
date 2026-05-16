import { describe, expect, it } from 'vitest'
import { extraerGalicia } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerGalicia.js'

describe('extraerGalicia', () => {
  it('extrae datos correctamente de Galicia', async () => {
    import.meta.env.VITE_FORCE_IA = 'true'
    const resultado = await extraerGalicia()

    expect(resultado).toBeInstanceOf(Array)

    if (resultado.length > 0) {
      expect(resultado).toHaveLength(1)
      expect(resultado[0]).toMatchObject({
        entidad: 'GALICIA',
        tasa: expect.any(Number),
      })
      expect(resultado[0].tasa).toBeGreaterThan(0)
      expect(resultado[0].tasa).toBeLessThan(100)

      if (resultado[0].tope !== null) {
        expect(resultado[0].tope).toBeGreaterThan(0)
      }
    }
  }, 30000)
})
