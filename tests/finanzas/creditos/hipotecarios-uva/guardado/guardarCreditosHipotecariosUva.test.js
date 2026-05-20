import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { extraerCreditosHipotecariosUva } from '@/finanzas/creditos/hipotecarios-uva/extraccion/extraerCreditosHipotecariosUva.js'
import { guardarCreditosHipotecariosUva } from '@/finanzas/creditos/hipotecarios-uva/guardado/guardarCreditosHipotecariosUva.js'

describe('guardarCreditosHipotecariosUva', () => {
  it('guarda los créditos hipotecarios UVA', async () => {
    const items = await extraerCreditosHipotecariosUva()

    expect(items.length).toBeGreaterThan(0)

    const esperado = await guardarCreditosHipotecariosUva(items)

    expect(esperado).toBeDefined()

    const guardado = await leerRuta('/finanzas/creditos/hipotecariosUva')

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  })
})
