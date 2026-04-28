import { describe, expect, it } from 'vitest'
import { extraerSupervielle } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerSupervielle.esjs'

describe('extraerSupervielle (Real)', () => {
  it('extrae datos correctamente de Supervielle', async () => {
    const resultado = await extraerSupervielle()

    expect(resultado).toBeInstanceOf(Array)

    if (resultado.length > 0) {
      expect(resultado).toHaveLength(1)
      expect(resultado[0].entidad).toBe('SUPERVIELLE')
      expect(typeof resultado[0].tasa).toBe('number')
      expect(resultado[0].tasa).toBeGreaterThan(0)
      if (resultado[0].tope !== null) {
        expect(resultado[0].tope).toBeGreaterThan(0)
      }
    }
  }, 30000)
})
