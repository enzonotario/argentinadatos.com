import { describe, expect, it } from 'vitest'
import { extraerBna } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerBna.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

describe.skipIf(!tieneIaCompleta)('extraerBna (Real)', () => {
  it('extrae datos correctamente de BNA', async () => {
    import.meta.env.VITE_FORCE_IA = 'true'

    try {
      const resultado = await extraerBna()

      expect(resultado).toHaveLength(1)
      expect(resultado[0].entidad).toBe('BNA')
      expect(typeof resultado[0].tasa).toBe('number')
      expect(resultado[0].tasa).toBeGreaterThan(0)
    } catch (error) {
      if (
        error.message.includes('401') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('API key')
      ) {
        console.warn('Test saltado por falta de API keys válidas')
      } else {
        throw error
      }
    }
  }, 30000)
})
