import { describe, expect, it } from 'vitest'
import {
  CAUCIONES_COLLECTION,
  classifyCaucionMoneda,
  fechaOperacionHoy,
  mergeTasaMinMaxDia,
} from '../../apps/worker/src/pocketbase/migrations/001_cauciones.js'
import { buildExistingMinMaxBySerie } from '../../apps/worker/src/pocketbase/caucionesRepository.js'

describe('worker cauciones migration schema', () => {
  it('defines normalized cauciones fields', () => {
    expect(CAUCIONES_COLLECTION.name).toBe('cauciones')
    expect(CAUCIONES_COLLECTION.type).toBe('base')
    expect(CAUCIONES_COLLECTION.listRule).toBeNull()
    expect(CAUCIONES_COLLECTION.fields.map(f => f.name)).toEqual([
      'plazo',
      'montoContado',
      'tasaPromedio',
      'tasaMinDia',
      'tasaMaxDia',
      'fechaOperacion',
      'fechaVencimiento',
      'moneda',
      'syncedAt',
    ])
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
  it('reinicia el rango si cambió el día operativo', () => {
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
    expect(fechaOperacionHoy(new Date('2026-08-22T15:00:00.000Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
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
