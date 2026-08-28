import { describe, expect, it } from 'vitest'
import { extraerSupervielleHitIolCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerSupervielleHitIol.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

import.meta.env.VITE_FORCE_IA = 'true'

describe.skipIf(!tieneIaCompleta)('extraerSupervielleHitIol', () => {
  it(
    'extrae Supervielle Cuenta Hit IOL (pesos) correctamente',
    async () => {
      const resultado = await extraerSupervielleHitIolCuentaRemunerada()

      expect(resultado).toMatchObject({
        fecha: expect.any(String),
        fondo: 'SUPERVIELLE HIT IOL',
        tea: expect.any(Number),
        tna: expect.any(Number),
        condiciones: expect.any(String),
        condicionesCorto: expect.any(String),
      })
      expect(resultado.tna).toBeGreaterThan(0)
    },
    {
      timeout: 500000,
    },
  )
})
