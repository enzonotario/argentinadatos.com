import { describe, expect, it } from 'vitest'
import {
  extraerListaFondos,
  extraerDetalleFondo,
  extraerDetallesFondos,
} from '@/finanzas/fci/detalles/extraccion/extraerDetallesFondos.esjs'

describe('extraerListaFondos', () => {
  it('extrae la lista de fondos desde CAFCI', async () => {
    const fondos = await extraerListaFondos()

    expect(fondos).toBeDefined()
    expect(Array.isArray(fondos)).toBe(true)
    expect(fondos.length).toBeGreaterThan(0)

    for (const fondo of fondos) {
      expect(fondo.fondoId).toBeTypeOf('string')
      expect(fondo.claseId).toBeTypeOf('string')
      expect(fondo.nombre).toBeTypeOf('string')
      expect(fondo.nombre.length).toBeGreaterThan(0)
    }
  }, 30000)
})

describe('extraerDetalleFondo', () => {
  it('extrae el detalle de un fondo específico', async () => {
    const detalle = await extraerDetalleFondo('798', '1982')

    expect(detalle).toBeDefined()
    expect(detalle).not.toBeNull()

    if (detalle) {
      expect(detalle.fondoId).toBe('798')
      expect(detalle.claseId).toBe('1982')
      expect(detalle.nombre).toBeTypeOf('string')
      expect(detalle.fecha).toBeTypeOf('string')

      expect(detalle.rendimientos).toBeDefined()
      expect(detalle.rendimientos).toBeTypeOf('object')

      expect(detalle.composicionCartera).toBeDefined()
      expect(Array.isArray(detalle.composicionCartera)).toBe(true)

      expect(detalle.calificaciones).toBeDefined()
      expect(Array.isArray(detalle.calificaciones)).toBe(true)

      expect(detalle.honorarios).toBeDefined()
      expect(detalle.honorarios).toBeTypeOf('object')

      expect(detalle.sociedades).toBeDefined()
      expect(Array.isArray(detalle.sociedades)).toBe(true)
    }
  }, 30000)

  it('retorna null para un fondo inexistente', async () => {
    const detalle = await extraerDetalleFondo('999999', '999999')
    expect(detalle).toBeNull()
  }, 30000)
})

describe('extraerDetallesFondos', () => {
  it('extrae los detalles de los primeros fondos', async () => {
    const datos = await extraerDetallesFondos(3)

    expect(datos).toBeDefined()
    expect(datos.fechaActualizacion).toBeTypeOf('string')
    expect(Array.isArray(datos.fondos)).toBe(true)
    expect(datos.fondos.length).toBeGreaterThan(0)

    const primer = datos.fondos[0]
    expect(primer.fondoId).toBeTypeOf('string')
    expect(primer.claseId).toBeTypeOf('string')
    expect(primer.nombre).toBeTypeOf('string')
    expect(primer.fecha).toBeTypeOf('string')
  }, 60000)
})
