import { describe, expect, it } from 'vitest'
import { extraerSupervielle } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerSupervielle.esjs'

describe('extraerSupervielle (Real)', () => {
  it('extrae datos correctamente de Supervielle', async () => {
    import.meta.env.VITE_FORCE_IA = 'true'

    try {
      const resultado = await extraerSupervielle()

      expect(resultado).toHaveLength(1)
      expect(resultado[0].entidad).toBe('SUPERVIELLE')
      expect(typeof resultado[0].tasa).toBe('number')
      expect(resultado[0].tasa).toBeGreaterThan(0)
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('API key')) {
        console.warn('Test saltado por falta de API keys válidas')
      } else {
        throw error
      }
    }
  }, 30000)
})
