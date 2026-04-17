import { describe, expect, it } from 'vitest'
import { extraerPlazoFijoPrecancelable } from '@/finanzas/extraccion/extraerPlazoFijoPrecancelable.esjs'

describe('extraerPlazoFijoPrecancelable', () => {
  it('extrae proveedores con condiciones de plazo fijo precancelable', async () => {
    const proveedores = await extraerPlazoFijoPrecancelable()

    console.log({ proveedores })

    expect(proveedores).toBeInstanceOf(Array)
    expect(proveedores.length).toBeGreaterThan(0)

    for (const id of ['bna', 'bbva', 'banco-provincia']) {
      const proveedor = proveedores.find(p => p.id === id)
      expect(proveedor).toBeDefined()
      expect(proveedor).toMatchObject({
        id,
        entidad: expect.any(String),
        logo: expect.any(String),
        enlace: expect.any(String),
        moneda: 'ARS',
        plazoMinDias: expect.any(Number),
        plazoPrecancelacionDias: expect.any(Number),
      })
      expect(proveedor.entidad).not.toBe('')
      expect(proveedor.plazoMinDias).toBeGreaterThan(0)
      expect(proveedor.plazoPrecancelacionDias).toBeGreaterThan(0)
      expect(proveedor.plazoPrecancelacionDias).toBeLessThanOrEqual(
        proveedor.plazoMinDias,
      )

      for (const campo of [
        'plazoMaxDias',
        'avisoPrecancelacionDias',
        'montoMinimo',
        'montoMaximo',
        'tna',
        'tea',
        'tnaPrecancelacion',
        'teaPrecancelacion',
      ]) {
        if (proveedor[campo] !== null) {
          expect(typeof proveedor[campo]).toBe('number')
        }
      }
    }
  }, 15000)
})
