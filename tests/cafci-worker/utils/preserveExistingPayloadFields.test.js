import { describe, expect, it } from 'vitest'
import {
  mergeCalificaciones,
  mergeSociedadesLogos,
  preserveExistingPayloadFields,
} from '../../../apps/cafci-worker/src/utils/preserveExistingPayloadFields.js'

describe('preserveExistingPayloadFields', () => {
  it('conserva composicionCartera cuando el ingest CNV no la trae', () => {
    const merged = preserveExistingPayloadFields(
      {
        composicionCartera: [{ nombre: 'Plazo Fijo', porcentaje: 80 }],
        benchmark: 'Badlar',
        duracion: 'Menor o Igual a 0.5 Año',
        horizonte: 'Plazo Flexible',
        region: 'Global',
      },
      {
        nombre: 'Mercado Fondo - Clase A',
        composicionCartera: [],
        benchmark: null,
        duracion: null,
        horizonte: null,
        region: null,
        patrimonio: 1000,
        sociedades: [],
        calificaciones: [],
        rendimientos: {},
      },
    )

    expect(merged.composicionCartera).toEqual([
      { nombre: 'Plazo Fijo', porcentaje: 80 },
    ])
    expect(merged.benchmark).toBe('Badlar')
    expect(merged.duracion).toBe('Menor o Igual a 0.5 Año')
    expect(merged.horizonte).toBe('Plazo Flexible')
    expect(merged.region).toBe('Global')
    expect(merged.patrimonio).toBe(1000)
  })

  it('conserva calificadora y fecha de calificación CAFCI', () => {
    const merged = preserveExistingPayloadFields(
      {
        calificaciones: [
          {
            calificadora: 'Univ. Nac. de Tres de Febrero',
            calificacion: 'A+(rf)BajRevespNeg',
            fecha: '2024-03-11',
          },
        ],
      },
      {
        calificaciones: [
          {
            calificadora: null,
            calificacion: 'A+(rf)BajRevespNeg',
            fecha: '2026-08-12',
          },
        ],
        rendimientos: {},
        sociedades: [],
      },
    )

    expect(merged.calificaciones[0]).toEqual({
      calificadora: 'Univ. Nac. de Tres de Febrero',
      calificacion: 'A+(rf)BajRevespNeg',
      fecha: '2024-03-11',
    })
  })

  it('conserva rendimientos largos que CNV no calcula', () => {
    const merged = preserveExistingPayloadFields(
      {
        rendimientos: {
          valorCuotaparte: 100,
          ultimos7Dias: 10,
          unMes: 12,
          noventaDias: 15,
          cientoOchentaDias: 18,
          enElAnio: 20,
          doceMeses: 22,
        },
      },
      {
        rendimientos: {
          valorCuotaparte: 101,
          ultimos7Dias: 11,
          unMes: 13,
          noventaDias: null,
          cientoOchentaDias: null,
          enElAnio: null,
          doceMeses: null,
        },
        sociedades: [],
        calificaciones: [],
      },
    )

    expect(merged.rendimientos).toMatchObject({
      valorCuotaparte: 101,
      ultimos7Dias: 11,
      unMes: 13,
      noventaDias: 15,
      cientoOchentaDias: 18,
      enElAnio: 20,
      doceMeses: 22,
    })
  })

  it('conserva logos de sociedades aunque cambie el tipo CAFCI→CNV', () => {
    const merged = preserveExistingPayloadFields(
      {
        sociedades: [
          {
            tipo: 'Sociedad Gerente:',
            nombre: 'Proahorro Administradora de Activos S.A.',
            logo: 'https://estadisticas.cafci.org.ar/assets/legacy/logos/00241G.jpg',
          },
          {
            tipo: 'Sociedad Depositaria:',
            nombre: 'Banco Credicoop Coop. Ltdo.',
            logo: 'https://estadisticas.cafci.org.ar/assets/legacy/logos/00116.jpg',
          },
        ],
      },
      {
        sociedades: [
          {
            tipo: 'Administradora',
            nombre: 'Proahorro Administradora de Activos S.A.',
            logo: null,
          },
          {
            tipo: 'Depositaria',
            nombre: 'Banco Credicoop Coop. Ltdo.',
            logo: null,
          },
        ],
        rendimientos: {},
        calificaciones: [],
      },
    )

    expect(merged.sociedades[0].logo).toContain('00241G.jpg')
    expect(merged.sociedades[1].logo).toContain('00116.jpg')
  })
})

describe('mergeCalificaciones', () => {
  it('rellena calificadora aunque el texto de nota difiera levemente', () => {
    const merged = mergeCalificaciones(
      [
        {
          calificadora: 'Fix',
          calificacion: 'AAf',
          fecha: '2025-12-29',
        },
      ],
      [
        {
          calificadora: null,
          calificacion: 'AAf(arg)',
          fecha: '2026-08-12',
        },
      ],
    )

    // sin match exacto de rating, usa fallback de la única calificadora conocida
    expect(merged[0].calificadora).toBe('Fix')
    expect(merged[0].fecha).toBe('2025-12-29')
  })
})

describe('mergeSociedadesLogos', () => {
  it('matchea por rol si el nombre no coincide exactamente', () => {
    const merged = mergeSociedadesLogos(
      [
        {
          tipo: 'Sociedad Gerente:',
          nombre: 'Vieja SA',
          logo: 'https://example.com/a.jpg',
        },
      ],
      [
        {
          tipo: 'Administradora',
          nombre: 'Nueva SA',
          logo: null,
        },
      ],
    )

    expect(merged[0].logo).toBe('https://example.com/a.jpg')
  })
})
