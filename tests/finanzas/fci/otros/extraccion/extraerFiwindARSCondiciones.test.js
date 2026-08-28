import { describe, expect, it } from 'vitest'
import { extraerFiwindARSCondiciones } from '@/finanzas/fci/otros/extraccion/extraerFiwindARSCondiciones.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

describe.skipIf(!tieneIaCompleta)('extraerFiwindARSCondiciones', () => {
  it('extrae condiciones de Fiwind ARS', async () => {
    const resultado = await extraerFiwindARSCondiciones()

    expect(resultado).toMatchObject({
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
    expect(resultado.condiciones.length).toBeGreaterThan(0)
    expect(resultado.condicionesCorto.length).toBeGreaterThan(0)
  }, 500000)
})
