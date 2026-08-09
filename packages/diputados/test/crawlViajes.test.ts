import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import {
  buildViajesEndpointMap,
  crawlViajes,
  matchViajeNombre,
  parseCsvText,
  parsePeriodoCelda,
  parseRecursoMeta,
  rowToViajeNacional,
  type ViajeRecurso,
} from '../src/diputados/viajes/crawlViajes'

describe('parseRecursoMeta / parsePeriodoCelda', () => {
  it('extrae año y semestre del nombre del recurso', () => {
    expect(parseRecursoMeta('Viajes Nacionales 1 Semestre 2026')).toEqual({
      anio: 2026,
      semestre: 1,
    })
    expect(parseRecursoMeta('Viajes Nacionales 2 semestre 2024')).toEqual({
      anio: 2024,
      semestre: 2,
    })
  })

  it('parsea períodos de fila', () => {
    expect(parsePeriodoCelda('jun-26', { anio: null, semestre: null })).toEqual({
      anio: 2026,
      mes: 6,
    })
    expect(parsePeriodoCelda('2024-12-01', { anio: null, semestre: null })).toEqual({
      anio: 2024,
      mes: 12,
    })
    expect(parsePeriodoCelda('2021 - ENERO', { anio: null, semestre: null })).toEqual({
      anio: 2021,
      mes: 1,
    })
    expect(parsePeriodoCelda('', { anio: 2018, semestre: 1 })).toEqual({
      anio: 2018,
      mes: 6,
    })
  })
})

describe('parseCsv + rowToViajeNacional', () => {
  const recurso: ViajeRecurso = {
    id: 'r1',
    nombre: 'Viajes Nacionales 1 Semestre 2026',
    url: 'https://example.com/a.csv',
    anio: 2026,
    semestre: 1,
  }

  it('parsea schema 2026', () => {
    const csv = `PERIODO,DIPUTADOS,TIPO_SOLICITUD,ORIGEN,DESTINO
jun-26,ALVAREZ CLAUDIO ARIEL,AEREO,AEROPUERTO X,AEROPARQUE Y
`
    const rows = parseCsvText(csv)
    const viaje = rowToViajeNacional(rows[0]!, recurso)
    expect(viaje).toMatchObject({
      anio: 2026,
      mes: 6,
      nombre: expect.stringMatching(/Alvarez/i),
      tipoSolicitud: expect.stringMatching(/Aereo/i),
      origen: expect.stringMatching(/Aeropuerto/i),
    })
  })

  it('parsea schema 2018 con Persona_id', () => {
    const csv = `Persona_id,Persona_apellido_y_nombre,Origen_ciudad,Origen_aeropuerto_estacion,Destino_ciudad,Destino_aeropuerto_estacion
HCDN01136,ABDALA NORMA AMANDA,Buenos Aires,AEP,Santiago del Estero,SDE
`
    const rows = parseCsvText(csv)
    const viaje = rowToViajeNacional(rows[0]!, {
      ...recurso,
      anio: 2018,
      semestre: 1,
      nombre: 'VIAJES NACIONALES 1 SEMESTRE 2018',
    })
    expect(viaje).toMatchObject({
      anio: 2018,
      mes: 6,
      diputadoId: 'HCDN01136',
      origenCodigo: 'AEP',
      destinoCodigo: 'SDE',
    })
  })

  it('matchea nombres APELLIDO NOMBRE vs apellido,nombre', () => {
    expect(
      matchViajeNombre('ALVAREZ CLAUDIO ARIEL', 'Alvarez', 'Claudio'),
    ).toBe(true)
    expect(
      matchViajeNombre('ALVAREZ CLAUDIO ARIEL', 'Alvarez', 'Pedro'),
    ).toBe(false)
  })
})

describe('buildViajesEndpointMap', () => {
  it('particiona por año/mes y por diputado', () => {
    const data = {
      fuente: 'x',
      actualizado: '2026-01-01',
      recursos: [],
      nacionales: [
        {
          ambito: 'nacional' as const,
          anio: 2026,
          mes: 6,
          mesNombre: 'Junio',
          recursoId: 'r',
          recursoUrl: 'u',
          recursoNombre: 'n',
          nombre: 'Test',
          diputadoId: 'HCDN1',
          tipoSolicitud: 'Aereo',
          origen: 'A',
          origenCodigo: null,
          destino: 'B',
          destinoCodigo: null,
          provincia: null,
          bloque: null,
        },
      ],
      internacionales: [] as [],
    }
    const map = buildViajesEndpointMap(data, ['HCDN1', 'HCDN2'])
    expect(map['/diputados/viajes/nacionales/2026/6']).toHaveLength(1)
    expect(map['/diputados/diputados/HCDN1/viajes']).toMatchObject({
      diputadoId: 'HCDN1',
      nacionales: [expect.objectContaining({ nombre: 'Test' })],
    })
    expect(map['/diputados/diputados/HCDN2/viajes']).toBeUndefined()
  })
})

describe('crawlViajes (red)', () => {
  it(
    'descarga CSVs HCDN, parsea y persiste /diputados/viajes',
    { timeout: 180_000 },
    async () => {
      const data = await crawlViajes()
      expect(data.recursos.length).toBeGreaterThan(10)
      expect(data.nacionales.length).toBeGreaterThan(1000)
      expect(data.fuente).toContain('viajes-nacionales')

      const persisted = JSON.parse(readEndpoint('/diputados/viajes') || '{}')
      expect(persisted.nacionales.length).toBe(data.nacionales.length)
      expect(
        JSON.parse(readEndpoint('/diputados/viajes/nacionales') || '[]').length,
      ).toBe(data.nacionales.length)
      expect(
        JSON.parse(readEndpoint('/diputados/viajes/conteo-12m') || '{}').porDiputado,
      ).toBeTruthy()
    },
  )
})
