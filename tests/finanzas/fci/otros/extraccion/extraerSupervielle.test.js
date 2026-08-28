import { describe, expect, it } from 'vitest'
import { extraerSupervielleCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerSupervielle.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

import.meta.env.VITE_FORCE_IA = 'true'

describe.skipIf(!tieneIaCompleta)('extraerSupervielle', () => {
  it(
    'extrae Supervielle Cuenta Remunerada correctamente',
    async () => {
      const resultado = await extraerSupervielleCuentaRemunerada()

      expect(resultado).toMatchObject({
        fecha: expect.any(String),
        fondo: 'SUPERVIELLE',
        tea: expect.any(Number),
        tna: expect.any(Number),
        tope: expect.any(Number),
        condiciones: null,
        condicionesCorto: expect.any(String),
      })
    },
    {
      timeout: 500000,
    },
  )
})
