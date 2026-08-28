import { describe, expect, it } from 'vitest'
import { extraerFiwindARS } from '@/finanzas/fci/otros/extraccion/extraerFiwindARS.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

describe.skipIf(!tieneIaCompleta)('extraerFiwindARS', () => {
  it('extrae FiwindARS Cuenta Remunerada correctamente', async () => {
    const resultado = await extraerFiwindARS()

    expect(resultado).toMatchObject({
      fecha: expect.any(String),
      fondo: 'FIWIND',
      tea: expect.any(Number),
      tna: expect.any(Number),
      tope: resultado.tope ? expect.any(Number) : null,
      condiciones: expect.any(String),
      condicionesCorto: expect.any(String),
    })
  }, 500000)
})
