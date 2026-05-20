import { describe, expect, it } from 'vitest'
import { extraerCarrefourCondiciones } from '@/finanzas/fci/otros/extraccion/extraerCarrefourCondiciones.js'

const tieneIaCompleta =
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENAI_API_KEY)

describe.skipIf(!tieneIaCompleta)('extraerCarrefourCondiciones', () => {
  it(
    'extrae condiciones de Carrefour o retorna el último conocido',
    async () => {
      const resultado = await extraerCarrefourCondiciones()

      if (resultado !== null) {
        expect(resultado).toMatchObject({
          topeRecargaMensual: expect.any(Number),
        })
        expect(resultado.topeRecargaMensual).toBeGreaterThan(0)
      }
    },
    {
      timeout: 500000,
    },
  )
})
