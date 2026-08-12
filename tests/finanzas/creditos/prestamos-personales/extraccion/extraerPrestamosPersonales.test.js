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
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js',
  () => ({
    extraerBna: vi.fn(async () => [
      { entidad: 'BNA', producto: 'Nación Sueldos', tna: 0.56 },
      { entidad: 'BNA', producto: 'Nación Destino Libre', tna: 0.74 },
    ]),
  }),
)

vi.mock(
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerCiudad.js',
  () => ({
    extraerCiudad: vi.fn(async () => [
      { entidad: 'CIUDAD', condiciones: 'Plan Sueldo', tna: 0.7 },
      { entidad: 'CIUDAD', condiciones: 'Jubilados y Pensionados ANSES', tna: 0.65 },
      { entidad: 'CIUDAD', condiciones: 'Cliente Fiel', tna: 0.87 },
    ]),
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
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerHipotecario.js',
  () => ({
    extraerHipotecario: vi.fn(async () => [
      { entidad: 'HIPOTECARIO', tna: 1.134 },
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
  '@/finanzas/creditos/prestamos-personales/extraccion/extraerPatagonia.js',
  () => ({
    extraerPatagonia: vi.fn(async () => [{ entidad: 'PATAGONIA', tna: 0.98 }]),
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

    expect(items).toHaveLength(14)
    expect(items.map((i) => i.entidad)).toEqual([
      'BANCOR',
      'BBVA',
      'BNA',
      'BNA',
      'CIUDAD',
      'CIUDAD',
      'CIUDAD',
      'GALICIA',
      'GALICIA',
      'GALICIA',
      'HIPOTECARIO',
      'MACRO',
      'PATAGONIA',
      'SANTANDER',
    ])
  })
})
