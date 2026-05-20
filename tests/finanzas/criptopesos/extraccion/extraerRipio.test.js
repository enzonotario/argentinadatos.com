import { describe, expect, it } from 'vitest'
import { calcularApy, extraerRipio } from '@/finanzas/criptopesos/extraccion/extraerRipio.js'
import { apyToTna } from '@/finanzas/criptopesos/apyToTna.js'

describe('calcularApy', () => {
  it('sin fee no modifica el APY', () => {
    expect(calcularApy(10, 0)).toBe(10)
    expect(calcularApy(0, 0)).toBe(0)
  })

  it('aplica el fee multiplicativamente (no como resta lineal)', () => {
    // apy=28.632%, fee=0.02% diario → ~19.58% (no 19.53% que daría la resta lineal)
    const resultado = calcularApy(28.632, 0.02)
    expect(resultado).toBe(19.58)
  })

  it('fee mayor reduce más el APY', () => {
    const sinFee = calcularApy(20, 0)
    const conFee = calcularApy(20, 0.05)
    expect(conFee).toBeLessThan(sinFee)
  })
})

describe('extraerRipio', () => {
  it(
    'extrae APY de wARS en Ripio API y lo retorna como wARS/RIPIO con TNA',
    async () => {
      const resultado = await extraerRipio()

      expect(resultado).toHaveLength(1)
      expect(resultado[0]).toMatchObject({
        token: 'wARS',
        entidad: 'RIPIO',
      })
      expect(resultado[0].tna).toBeTypeOf('number')
      expect(resultado[0].tna).toBeGreaterThanOrEqual(0)
      expect(resultado[0].tna).toBeLessThanOrEqual(1)
    },
    15000,
  )
})

describe('apyToTna', () => {
  it('convierte correctamente un APY positivo a TNA nominal', () => {
    const segundosPorAnio = 365 * 24 * 60 * 60
    const slotSeconds = 12.04
    const n = segundosPorAnio / slotSeconds

    const apy = 0.2863
    const tna = apyToTna(apy, n)

    expect(tna).toBeGreaterThan(0.24)
    expect(tna).toBeLessThan(0.27)
  })
})
