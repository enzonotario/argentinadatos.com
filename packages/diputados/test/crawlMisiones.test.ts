import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import {
  buildMisionesEndpointMap,
  crawlMisiones,
  matchMisionesDiputadoIds,
  rowToMisionOficial,
  type MisionRecurso,
} from '../src/diputados/misiones/crawlMisiones'
import { parseCsvText } from '../src/diputados/viajes/crawlViajes'

const recurso: MisionRecurso = {
  id: 'm1',
  nombre: 'Misiones 2024',
  url: 'https://example.com/m.csv',
}

describe('rowToMisionOficial', () => {
  it('parsea fila típica de misiones', () => {
    const csv = `fecha_inicio,fecha_fin,participa,ciudad_viaje,lugar,motivo,bloque,viaticos_consumidos,moneda,institucion_que_invita
2024-03-10,2024-03-15,ALVAREZ CLAUDIO,Brasilia,Brasil,Reunion bilateral,UPP,U$S 1200,USD,Parlamento Mercosur
`
    const rows = parseCsvText(csv)
    const mision = rowToMisionOficial(rows[0]!, recurso)
    expect(mision).toMatchObject({
      anio: 2024,
      mes: 3,
      diputadoId: null,
      viaticosUsd: 1200,
      destino: expect.stringMatching(/Brasil/i),
      institucion: expect.stringMatching(/Mercosur/i),
    })
    expect(mision?.nombre).toMatch(/Alvarez/i)
  })

  it('omite filas placeholder', () => {
    const csv = `participa,motivo
s/n,no se realizaron misiones
`
    const rows = parseCsvText(csv)
    expect(rowToMisionOficial(rows[0]!, recurso)).toBeNull()
  })
})

describe('matchMisionesDiputadoIds', () => {
  it('asigna diputadoId por apellido|nombre', () => {
    const misiones = [
      {
        anio: 2024,
        mes: 3,
        mesNombre: 'Marzo',
        documentoId: 'm1',
        documentoUrl: 'u',
        recursoId: 'm1',
        recursoUrl: 'u',
        recursoNombre: 'n',
        nombre: 'Alvarez, Claudio',
        diputadoId: null,
        institucion: null,
        destino: 'Brasil',
        fechaInicio: '2024-03-10',
        fechaFin: '2024-03-15',
        fechaTexto: '2024-03-10 – 2024-03-15',
        viaticos: true,
        viaticosUsd: 100,
        viaticosEuro: null,
        viaticosArs: null,
        motivo: 'x',
        bloque: null,
      },
    ]
    matchMisionesDiputadoIds(misiones, [
      { id: 'HCDN1', apellido: 'Alvarez', nombre: 'Claudio' },
    ])
    expect(misiones[0]!.diputadoId).toBe('HCDN1')
  })
})

describe('buildMisionesEndpointMap', () => {
  it('particiona por año y por diputado', () => {
    const data = {
      fuente: 'x',
      actualizado: '2026-01-01',
      recursos: [],
      misiones: [
        {
          anio: 2024,
          mes: 3,
          mesNombre: 'Marzo',
          documentoId: 'm1',
          documentoUrl: 'u',
          recursoId: 'm1',
          recursoUrl: 'u',
          recursoNombre: 'n',
          nombre: 'Test',
          diputadoId: 'HCDN1',
          institucion: null,
          destino: 'Brasil',
          fechaInicio: '2024-03-10',
          fechaFin: '2024-03-15',
          fechaTexto: null,
          viaticos: null,
          viaticosUsd: null,
          viaticosEuro: null,
          viaticosArs: null,
          motivo: null,
          bloque: null,
        },
      ],
    }
    const map = buildMisionesEndpointMap(data)
    expect(map['/diputados/misiones/lista']).toHaveLength(1)
    expect(map['/diputados/misiones/2024']).toHaveLength(1)
    expect(map['/diputados/diputados/HCDN1/misiones']).toMatchObject({
      diputadoId: 'HCDN1',
      misiones: [expect.objectContaining({ destino: 'Brasil' })],
    })
  })
})

describe('crawlMisiones (red)', () => {
  it(
    'descarga CSVs HCDN y persiste /diputados/misiones',
    { timeout: 300_000 },
    async () => {
      const data = await crawlMisiones()
      expect(data.recursos.length).toBeGreaterThan(5)
      expect(data.misiones.length).toBeGreaterThan(10)
      expect(data.fuente).toContain('misiones-oficiales')

      const persisted = JSON.parse(readEndpoint('/diputados/misiones') || '{}')
      expect(persisted.misiones.length).toBe(data.misiones.length)
      expect(
        JSON.parse(readEndpoint('/diputados/misiones/lista') || '[]').length,
      ).toBe(data.misiones.length)
    },
  )
})
