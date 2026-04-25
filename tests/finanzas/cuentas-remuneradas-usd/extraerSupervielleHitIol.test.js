import { describe, expect, it } from 'vitest'
import { extraerSupervielleHitIol } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerSupervielleHitIol.esjs'

describe('extraerSupervielleHitIol (Real)', () => {
  it('extrae datos correctamente de Supervielle Hit IOL', async () => {
    import.meta.env.VITE_FORCE_IA = 'true'

    try {
      const resultado = await extraerSupervielleHitIol()

      expect(resultado).toHaveLength(1)
      expect(resultado[0].entidad).toBe('SUPERVIELLE Hit IOL')
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
