import { describe, expect, it, vi } from 'vitest'
import { extraerPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerPrestamosPersonales.js'

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js',
  () => ({
    extraerBna: vi.fn(async () => [{ entidad: 'BNA', tna: 0.74 }]),
  }),
)

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBnaNacionSueldos.js',
  () => ({
    extraerBnaNacionSueldos: vi.fn(async () => [
      { entidad: 'BNA', tna: 0.56 },
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
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerGalicia.js',
  () => ({
    extraerGalicia: vi.fn(async () => [{ entidad: 'GALICIA', tna: 0.79 }]),
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

    expect(items).toHaveLength(7)
    expect(items.map((i) => i.entidad)).toEqual([
      'BNA',
      'BNA',
      'BBVA',
      'GALICIA',
      'MACRO',
      'SANTANDER',
      'SUPERVIELLE',
    ])
  })
})
