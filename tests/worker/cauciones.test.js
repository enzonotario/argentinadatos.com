import { describe, expect, it } from 'vitest'
import {
  CAUCIONES_COLLECTION,
  classifyCaucionMoneda,
  deriveFechaOperacion,
  fechaOperacionHoy,
  impliedFechaOperacion,
  isCaucionPlazoCoherent,
  mergeTasaMinMaxDia,
  buildExistingMinMaxBySerie,
  migrations,
} from '@argentinadatos/pocketbase'

describe('worker cauciones schema', () => {
  it('defines normalized cauciones fields', () => {
    expect(CAUCIONES_COLLECTION.name).toBe('cauciones')
    expect(CAUCIONES_COLLECTION.type).toBe('base')
    expect(CAUCIONES_COLLECTION.listRule).toBeNull()
    expect(CAUCIONES_COLLECTION.fields.map(f => f.name)).toEqual([
      'plazo',
      'montoContado',
      'tasaActual',
      'tasaMinDia',
      'tasaMaxDia',
      'fechaOperacion',
      'fechaVencimiento',
      'moneda',
      'fechaActualizacion',
    ])
  })
})

describe('pocketbase migrations registry', () => {
  it('incluye la migración de cauciones al inicio del registry', () => {
    const ids = migrations.map(m => m.id)
    expect(ids[0]).toBe('002_cauciones')
    expect(ids).toContain('003_letras')
    expect(ids).toContain('009_congreso')
  })
})

describe('classifyCaucionMoneda', () => {
  it('splits ARS vs USD by tasa gap', () => {
    expect(classifyCaucionMoneda(18.5)).toBe('ars')
    expect(classifyCaucionMoneda(25)).toBe('ars')
    expect(classifyCaucionMoneda(1.25)).toBe('usd')
    expect(classifyCaucionMoneda(2.95)).toBe('usd')
    expect(classifyCaucionMoneda(9.99)).toBe('usd')
    expect(classifyCaucionMoneda(10)).toBe('ars')
  })
})

describe('mergeTasaMinMaxDia', () => {
  it('reinicia el rango si cambió el día de operación', () => {
    expect(
      mergeTasaMinMaxDia({
        existing: {
          tasaMinDia: 18,
          tasaMaxDia: 28.5,
          fechaOperacion: '2026-08-21',
        },
        snapshotTasas: [20, 22],
        fechaOperacion: '2026-08-22',
      }),
    ).toEqual({
      tasaMinDia: 20,
      tasaMaxDia: 22,
      fechaOperacion: '2026-08-22',
    })
  })

  it('ensancha min/max dentro del mismo día', () => {
    expect(
      mergeTasaMinMaxDia({
        existing: {
          tasaMinDia: 18,
          tasaMaxDia: 25,
          fechaOperacion: '2026-08-22',
        },
        snapshotTasas: [19, 28.5],
        fechaOperacion: '2026-08-22',
      }),
    ).toEqual({
      tasaMinDia: 18,
      tasaMaxDia: 28.5,
      fechaOperacion: '2026-08-22',
    })
  })
})

describe('buildExistingMinMaxBySerie', () => {
  it('agrupa por moneda+plazo', () => {
    const map = buildExistingMinMaxBySerie([
      {
        moneda: 'ars',
        plazo: 2,
        tasaMinDia: 18,
        tasaMaxDia: 20,
        fechaOperacion: '2026-08-22',
      },
      {
        moneda: 'ars',
        plazo: 2,
        tasaMinDia: 17,
        tasaMaxDia: 22,
        fechaOperacion: '2026-08-22',
      },
    ])
    expect(map.get('ars:2')).toEqual({
      tasaMinDia: 17,
      tasaMaxDia: 22,
      fechaOperacion: '2026-08-22',
    })
  })
})

describe('fechaOperacionHoy', () => {
  it('devuelve YYYY-MM-DD', () => {
    expect(
      fechaOperacionHoy(new Date('2026-08-22T15:00:00.000Z')),
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('deriveFechaOperacion / coherencia IOL', () => {
  const iolTitulos = [
    {
      plazo: 1,
      montoContado: 5883015385726,
      tasaPromedio: 20.5,
      fechaVencimiento: '2026-09-11T00:00:00',
    },
    {
      plazo: 40,
      montoContado: 148034045,
      tasaPromedio: 20.2,
      fechaVencimiento: '2026-10-20T00:00:00',
    },
    {
      plazo: 160,
      montoContado: 811612,
      tasaPromedio: 20.3,
      fechaVencimiento: '2026-09-18T00:00:00',
    },
    {
      plazo: 4,
      montoContado: 20037442972,
      tasaPromedio: 20.6,
      fechaVencimiento: '2026-09-14T00:00:00',
    },
    {
      plazo: 8,
      montoContado: 646641481,
      tasaPromedio: 20,
      fechaVencimiento: '2026-09-18T00:00:00',
    },
    {
      plazo: 44,
      montoContado: 100,
      tasaPromedio: 1.25,
      fechaVencimiento: '2026-09-22T00:00:00',
    },
  ]

  it('infiere vencimiento − plazo', () => {
    expect(impliedFechaOperacion('2026-09-11T00:00:00', 1)).toBe('2026-09-10')
    expect(impliedFechaOperacion('2026-10-20T00:00:00', 40)).toBe('2026-09-10')
    expect(impliedFechaOperacion('2026-09-18T00:00:00', 160)).toBe('2026-04-11')
  })

  it('elige la rueda modal reciente (no “hoy” ni outliers +160)', () => {
    expect(
      deriveFechaOperacion(iolTitulos, {
        now: new Date('2026-09-17T18:00:00.000Z'),
      }),
    ).toBe('2026-09-10')
  })

  it('acepta series coherentes con la rueda y rechaza plazos inflados', () => {
    const fechaOperacion = '2026-09-10'
    expect(
      isCaucionPlazoCoherent(1, fechaOperacion, '2026-09-11T00:00:00'),
    ).toBe(true)
    expect(
      isCaucionPlazoCoherent(40, fechaOperacion, '2026-10-20T00:00:00'),
    ).toBe(true)
    expect(
      isCaucionPlazoCoherent(160, fechaOperacion, '2026-09-18T00:00:00'),
    ).toBe(false)
    expect(
      isCaucionPlazoCoherent(44, fechaOperacion, '2026-09-22T00:00:00'),
    ).toBe(false)
  })

  it('cae a hoy si no hay consenso reciente', () => {
    expect(
      deriveFechaOperacion(
        [
          {
            plazo: 160,
            fechaVencimiento: '2026-09-18T00:00:00',
          },
        ],
        { now: new Date('2026-09-17T18:00:00.000Z') },
      ),
    ).toBe('2026-09-17')
  })
})

describe('URLSearchParams password encoding', () => {
  it('encodes IOL special characters needed for form bodies', () => {
    const body = new URLSearchParams({
      username: 'user@example.com',
      password: 'a*b@c=d+e',
      grant_type: 'password',
    })
    const encoded = body.toString()
    expect(encoded).toContain('password=a*b%40c%3Dd%2Be')
    expect(encoded).toContain('username=user%40example.com')
  })
})
