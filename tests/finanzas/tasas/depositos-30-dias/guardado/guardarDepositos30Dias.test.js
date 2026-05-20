import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { extraerTasasDepositos30Dias } from '@/finanzas/tasas/depositos-30-dias/extraccion/extraerTasasDepositos30Dias.js'
import { guardarTasasDepositos30Dias } from '@/finanzas/tasas/depositos-30-dias/guardado/guardarTasasDepositos30Dias.js'
import { format, subDays, addDays } from 'date-fns'

describe('guardarDepositos30Dias', () => {
  it('guarda los depósitos a 30 días', async () => {
    const items = await extraerTasasDepositos30Dias(
      format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    )

    expect(items.length).toBeGreaterThan(0)

    const esperado = await guardarTasasDepositos30Dias(items)

    expect(esperado).toBeDefined()

    const guardado = await leerRuta('/finanzas/tasas/depositos30Dias')

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  })
})
