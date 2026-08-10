import { describe, expect, it, vi } from 'vitest'
import { extraerPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerPrestamosPersonales.js'

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js',
  () => ({
    extraerBna: vi.fn(async () => [
      { entidad: 'BNA', tna: 0.74 },
      { entidad: 'BNA', tna: 0.91 },
    ]),
  }),
)

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js',
  () => ({
    extraerBbva: vi.fn(async () => [{ entidad: 'BBVA', tna: 1.29 }]),
  }),
)

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerSupervielle.js',
  () => ({
    extraerSupervielle: vi.fn(async () => [
      { entidad: 'SUPERVIELLE', tna: 1.45 },
    ]),
  }),
)

describe('extraerPrestamosPersonales', () => {
  it('aplana resultados de todos los bancos', async () => {
    const items = await extraerPrestamosPersonales()

    expect(items).toHaveLength(4)
    expect(items.map((i) => i.entidad)).toEqual([
      'BNA',
      'BNA',
      'BBVA',
      'SUPERVIELLE',
    ])
  })
})
