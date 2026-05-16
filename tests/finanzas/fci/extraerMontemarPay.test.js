import { describe, expect, it } from 'vitest'
import { extraerMontemarPayCuentaRemunerada } from '@/finanzas/extraccion/extraerMontemarPay.js'

describe('extraerMontemarPayCuentaRemunerada', () => {
  it('extrae la TNA de Montemar Pay', async () => {
    const resultado = await extraerMontemarPayCuentaRemunerada()

    expect(resultado).toBeDefined()
    expect(resultado.fondo).toBe('MONTEMAR PAY')
    expect(resultado.tna).toBe(0.4)
    expect(resultado.tea).toBeDefined()
    expect(resultado.fecha).toBeDefined()
    expect(resultado.tope).toBeNull()
  }, 10000)
})

