import { describe, expect, it } from 'vitest'
import { extraerRipio } from '@/finanzas/criptopesos/extraccion/extraerRipio.esjs'

describe('extraerRipio', () => {
  it(
    'extrae APY de wARS en Ripio API y lo retorna como wARS/RIPIO con TNA',
    async () => {
      const resultado = await extraerRipio()

      console.log({ resultado })

      expect(resultado).toHaveLength(1)
      expect(resultado[0]).toMatchObject({
        token: 'wARS',
        entidad: 'RIPIO',
      })
      expect(resultado[0].tna).toBeTypeOf('number')
      expect(resultado[0].tna).toBeGreaterThanOrEqual(0)
    },
    15000,
  )
})
