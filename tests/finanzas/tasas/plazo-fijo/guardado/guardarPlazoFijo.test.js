import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { extraerPlazoFijo } from '@/finanzas/tasas/plazo-fijo/extraccion/extraerPlazoFijo.js'
import { guardarPlazoFijo } from '@/finanzas/tasas/plazo-fijo/guardado/guardarPlazoFijo.js'

describe('guardarPlazoFijo', () => {
  it('guarda los plazos fijos', async () => {
    const items = await extraerPlazoFijo()

    expect(items.length).toBeGreaterThan(0)

    const esperado = await guardarPlazoFijo(items)

    expect(esperado).toBeDefined()

    const guardado = await leerRuta('/finanzas/tasas/plazoFijo', items)

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  })
})
