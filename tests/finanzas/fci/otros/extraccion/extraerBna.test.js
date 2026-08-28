import { describe, expect, it } from 'vitest'
import { extraerBnaCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerBna.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

describe.skipIf(!tieneIaCompleta)('extraerBna', () => {
  it(
    'extrae BNA Cuenta Remunerada correctamente',
    async () => {
      import.meta.env.VITE_FORCE_IA = 'true'
      const resultado = await extraerBnaCuentaRemunerada()

      expect(resultado).toMatchObject({
        fecha: expect.any(String),
        fondo: 'BNA',
        tea: expect.any(Number),
        tna: expect.any(Number),
        tope: expect.any(Number),
        condiciones: expect.anything(),
        condicionesCorto: expect.anything(),
      })
    },
    {
      timeout: 500000,
    },
  )
})
