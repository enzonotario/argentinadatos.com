import { describe, expect, it } from 'vitest'
import { extraerCapyfi } from '@/finanzas/criptopesos/extraccion/extraerCapyfi.js'

const token = import.meta.env.VITE_FINANZAS_CAPYFI_TOKEN
const baseUrl = import.meta.env.VITE_FINANZAS_CAPYFI_API_URL
const hasEnv = Boolean(token && baseUrl)

describe('extraerCapyfi', () => {
  it.skipIf(!hasEnv)(
    'extrae APY de market-apy y lo retorna como wARS/CAPYFI con TNA nominal anual',
    async () => {
      const resultado = await extraerCapyfi()

      expect(resultado).toHaveLength(1)
      expect(resultado[0]).toMatchObject({
        token: 'wARS',
        entidad: 'CAPYFI',
      })
      expect(resultado[0].tna).toBeTypeOf('number')
      expect(resultado[0].tna).toBeGreaterThanOrEqual(0)
      expect(resultado[0].tna).toBeLessThanOrEqual(1)
    },
    15000,
  )
})
