import { describe, expect, it } from 'vitest'
import { extraerCuentasRemuneradasUsd } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerCuentasRemuneradasUsd.esjs'

describe('extraerCuentasRemuneradasUsd (Real)', () => {
  it('extrae datos de todas las entidades', async () => {
    import.meta.env.VITE_FORCE_IA = 'true'

    try {
      const resultado = await extraerCuentasRemuneradasUsd()

      expect(resultado).toBeInstanceOf(Array)
      expect(resultado.length).toBeGreaterThan(0)
      
      resultado.forEach(item => {
        expect(item.entidad).toBeDefined()
        expect(typeof item.tasa).toBe('number')
      })
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('API key')) {
        console.warn('Test saltado por falta de API keys válidas')
      } else {
        throw error
      }
    }
  }, 60000)
})
