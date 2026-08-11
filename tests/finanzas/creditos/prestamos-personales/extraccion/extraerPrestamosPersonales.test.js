import { describe, expect, it, vi } from 'vitest'
import { extraerPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerPrestamosPersonales.js'

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBancor.js',
  () => ({
    extraerBancor: vi.fn(async () => [{ entidad: 'BANCOR', tna: 0.65 }]),
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
    extraerGalicia: vi.fn(async () => [
      { entidad: 'GALICIA', condiciones: 'Servicio Éminent', tna: 0.79 },
      { entidad: 'GALICIA', condiciones: 'Servicio PLUS GOLD y PLUS', tna: 0.99 },
      { entidad: 'GALICIA', condiciones: 'Servicio MOVE', tna: 1.42 },
    ]),
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

    expect(items).toHaveLength(7)
    expect(items.map((i) => i.entidad)).toEqual([
      'BANCOR',
      'BBVA',
      'GALICIA',
      'GALICIA',
      'GALICIA',
      'MACRO',
      'SANTANDER',
    ])
  })
})
