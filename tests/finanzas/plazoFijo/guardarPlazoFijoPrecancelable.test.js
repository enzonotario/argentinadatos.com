import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.esjs'
import { extraerPlazoFijoPrecancelable } from '@/finanzas/extraccion/extraerPlazoFijoPrecancelable.esjs'
import { guardarPlazoFijoPrecancelable } from '@/finanzas/guardado/guardarPlazoFijoPrecancelable.esjs'

describe('guardarPlazoFijoPrecancelable', () => {
  it('guarda los plazos fijos precancelables', async () => {
    const items = await extraerPlazoFijoPrecancelable()

    expect(items.length).toBeGreaterThan(0)

    const esperado = await guardarPlazoFijoPrecancelable(items)

    expect(esperado).toBeDefined()

    const guardado = await leerRuta('/finanzas/tasas/plazoFijoPrecancelable')

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  }, 15000)
})
