import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import {
  buildComisionesFromHcdn,
  crawlComisiones,
  matchDiputadoIdByNombre,
} from '../src/diputados/comisiones/crawlComisiones'

describe('matchDiputadoIdByNombre', () => {
  const diputados = [
    { id: 'HCDN1', apellido: 'Alvarez', nombre: 'Claudio' },
    { id: 'HCDN2', apellido: 'Perez', nombre: 'Ana' },
  ]

  it('matchea APELLIDO, Nombre', () => {
    expect(matchDiputadoIdByNombre('Alvarez, Claudio', diputados)).toBe('HCDN1')
  })

  it('matchea APELLIDO Nombre sin coma', () => {
    expect(matchDiputadoIdByNombre('ALVAREZ CLAUDIO', diputados)).toBe('HCDN1')
  })

  it('no matchea si hay ambigüedad', () => {
    expect(matchDiputadoIdByNombre('Desconocido, Foo', diputados)).toBeNull()
  })
})

describe('buildComisionesFromHcdn', () => {
  it('arma catálogo + integrantes + cargos de autoridades', () => {
    const comisiones = buildComisionesFromHcdn({
      catalog: [
        {
          ID: '10',
          NOMBRE: 'ASUNTOS CONSTITUCIONALES',
          TIPO_DE_COMISION: 'P',
          GRUPO: 'CD',
          PERIODO_DE_INICIO: '143',
          PERIODO_DE_FINALIZACION: '143',
          FECHA_DE_INICIO: '2023-12-10',
          FECHA_DE_FINALIZACION: '',
        },
      ],
      integrantes: [
        {
          COMISION_ID: '10',
          DIPUTADO_NOMBRE: 'ALVAREZ CLAUDIO',
          DISTRITO: 'Buenos Aires',
        },
      ],
      autoridades: [
        {
          COMISION_ID: '10',
          DIPUTADO_NOMBRE: 'ALVAREZ CLAUDIO',
          CARGO: 'PRESIDENTE',
          BLOQUE: 'UNION POR LA PATRIA',
        },
      ],
      diputados: [{ id: 'HCDN1', apellido: 'Alvarez', nombre: 'Claudio' }],
    })

    expect(comisiones).toHaveLength(1)
    expect(comisiones[0]).toMatchObject({
      id: '10',
      tipo: 'Permanente',
      tipoCodigo: 'P',
    })
    expect(comisiones[0]!.integrantes[0]).toMatchObject({
      cargo: 'Presidente',
      diputadoId: 'HCDN1',
      distrito: 'Buenos Aires',
    })
  })
})

describe('crawlComisiones (red)', () => {
  it(
    'descarga JSON HCDN y persiste /diputados/comisiones',
    { timeout: 120_000 },
    async () => {
      const data = await crawlComisiones()
      expect(data.length).toBeGreaterThan(20)
      expect(data.some(c => c.integrantes.length > 0)).toBe(true)

      const persisted = JSON.parse(readEndpoint('/diputados/comisiones') || '[]')
      expect(persisted.length).toBe(data.length)
      const sample = data.find(c => c.integrantes.some(i => i.diputadoId))
      expect(sample).toBeTruthy()
      if (sample) {
        const detail = JSON.parse(
          readEndpoint(`/diputados/comisiones/${sample.id}`) || '{}',
        )
        expect(detail.id).toBe(sample.id)
      }
    },
  )
})
