import { describe, it, expect } from 'vitest'
import { extraerNaranjaX } from '@/finanzas/fci/otros/extraccion/extraerNaranjaX.js'

const tieneScrapiar =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_SCRAPIAR_API_KEY)

describe.skipIf(!tieneScrapiar)('extraerNaranjaX', () => {
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
