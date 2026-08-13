import { describe, expect, it } from 'vitest'
import {
  mapFondoToSerieItem,
  mapHistoricoToSerieItem,
} from '@/finanzas/fci/series/mapFondoToSerieItem.js'
import {
  inferSerieKey,
  mapHorizonteSerie,
} from '@/finanzas/fci/series/seriesCategories.js'

describe('seriesCategories', () => {
  it('mapea tipo de renta a claves de serie', () => {
    expect(inferSerieKey('Mercado de Dinero')).toBe('mercadoDinero')
    expect(inferSerieKey('Renta Fija')).toBe('rentaFija')
  })

  it('normaliza horizontes al contrato de la API', () => {
    expect(mapHorizonteSerie('Corto Plazo')).toBe('corto')
    expect(mapHorizonteSerie('Mediano Plazo')).toBe('medio')
    expect(mapHorizonteSerie('Largo Plazo')).toBe('largo')
  })
})

describe('mapFondoToSerieItem', () => {
  it('adapta un fondo SQLite al contrato de series', () => {
    expect(
      mapFondoToSerieItem({
        nombre: 'Alpha Pesos - Clase A',
        horizonte: 'Corto Plazo',
        fecha: '2026-08-12',
        patrimonio: 1619363359432.52,
        cantidadCuotapartes: 15903728862.52,
        rendimientos: { valorCuotaparte: 101822.873 },
      }),
    ).toEqual({
      fondo: 'Alpha Pesos - Clase A',
      horizonte: 'corto',
      fecha: '2026-08-12',
      vcp: 101822.873,
      ccp: 15903728862.52,
      patrimonio: 1619363359432.52,
    })
  })

  it('deriva ccp desde patrimonio/vcp cuando falta cantidadCuotapartes', () => {
    expect(
      mapHistoricoToSerieItem({
        nombre: 'Mercado Fondo - Clase A',
        horizonte: 'corto',
        fecha: '2026-05-20',
        valorCuotaparte: 100,
        patrimonio: 1000,
      }),
    ).toMatchObject({
      ccp: 10,
      vcp: 100,
      patrimonio: 1000,
    })
  })
})
