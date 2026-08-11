import { describe, expect, it, vi } from 'vitest'
import { extraerPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerPrestamosPersonales.js'

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js',
  () => ({
    extraerBbva: vi.fn(async () => [{ entidad: 'BBVA', tna: 1.29 }]),
  }),
)

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerMacro.js',
  () => ({
    extraerMacro: vi.fn(async () => [{ entidad: 'MACRO', tna: 0.56 }]),
  }),
)

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerSantander.js',
  () => ({
    extraerSantander: vi.fn(async () => [{ entidad: 'SANTANDER', tna: 0.79 }]),
  }),
)

describe('extraerPrestamosPersonales', () => {
  it('aplana resultados de bancos con tasas por tramo', async () => {
    const items = await extraerPrestamosPersonales()

    expect(items).toHaveLength(3)
    expect(items.map((i) => i.entidad)).toEqual([
      'BBVA',
      'MACRO',
      'SANTANDER',
    ])
  })
})
