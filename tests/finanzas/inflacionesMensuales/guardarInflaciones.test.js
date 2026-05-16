import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { extraerInflaciones } from '@/finanzas/extraccion/extraerInflaciones.js'
import { guardarInflaciones } from '@/finanzas/guardado/guardarInflaciones.js'
import { subMonths, addMonths, format } from 'date-fns'

describe('guardarInflaciones', () => {
  it('guarda los inflaciones del año', async () => {
    const desde = subMonths(new Date(), 3)
    const hasta = addMonths(new Date(), 3)
    const inflaciones = await extraerInflaciones(
      format(desde, 'yyyy-MM-dd'),
      format(hasta, 'yyyy-MM-dd'),
    )

    expect(inflaciones.length).toBeGreaterThan(0)

    const esperado = await guardarInflaciones(inflaciones)

    expect(esperado).toBeDefined()

    const guardado = await leerRuta('/finanzas/indices/inflacion', inflaciones)

    for (const inflacion of inflaciones) {
      expect(guardado).toContainEqual(inflacion)
    }
  })
})
