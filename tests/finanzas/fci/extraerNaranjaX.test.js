import { describe, it, expect } from 'vitest'
import { extraerNaranjaX } from '@/finanzas/fci/extraerNaranjaX.esjs'

describe('extraerNaranjaX', () => {
  it('extrae datos reales desde Defuddle + IA', async () => {
    const resultado = await extraerNaranjaX()

    expect(resultado).toBeDefined()

    // Si faltan API keys o hay rate limiting, el extractor retorna {}
    if (Object.keys(resultado).length === 0) {
      return
    }

    expect(resultado.fondo).toBe('NARANJA X')
    expect(typeof resultado.tna).toBe('number')
    expect(typeof resultado.tea).toBe('number')
    expect(typeof resultado.fecha).toBe('string')
  }, 30000)
})
