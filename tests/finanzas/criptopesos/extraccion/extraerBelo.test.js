import { describe, expect, it } from 'vitest'
import { extraerBelo } from '@/finanzas/criptopesos/extraccion/extraerBelo.js'

describe('extraerBelo', () => {
  it(
    'extrae TNA de ARGt en Belo API y lo retorna como ARGt/BELO',
    async () => {
      const resultado = await extraerBelo()

      expect(resultado).toHaveLength(1)
      expect(resultado[0]).toMatchObject({
        token: 'ARGt',
        entidad: 'BELO',
      })
      expect(resultado[0].tna).toBeTypeOf('number')
      expect(resultado[0].tna).toBeGreaterThan(0)
      expect(resultado[0].tna).toBeLessThanOrEqual(1)
    },
    15000,
  )
})
