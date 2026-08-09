import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import {
  aggregatePeriodosFromHcdnRows,
  crawlPeriodos,
  tipoFromPeriodoId,
} from '../src/diputados/periodos/crawlPeriodos'

describe('tipoFromPeriodoId / aggregatePeriodosFromHcdnRows', () => {
  it('clasifica sufijos O/E/D', () => {
    expect(tipoFromPeriodoId('HCDN143O')).toBe('ordinario')
    expect(tipoFromPeriodoId('HCDN143E')).toBe('extraordinario')
    expect(tipoFromPeriodoId('HCDN141D')).toBe('prorroga')
    expect(tipoFromPeriodoId('HCDN141X')).toBe('otro')
  })

  it('agrega tramos por número de período (min inicio / max fin)', () => {
    const periodos = aggregatePeriodosFromHcdnRows([
      {
        ID: 'HCDN143O',
        PERIODO: '143',
        SESIONES: '2025-03-01 00:00:00.000',
        INICIO: '2025-03-01 00:00:00.000',
        FIN: '2025-11-30 00:00:00.000',
      },
      {
        ID: 'HCDN143E',
        PERIODO: '143',
        SESIONES: '2025-03-01 00:00:00.000',
        INICIO: '2025-12-01 00:00:00.000',
        FIN: '2026-02-28 00:00:00.000',
      },
      {
        ID: 'HCDN144O',
        PERIODO: '144',
        SESIONES: '2026-03-01 00:00:00.000',
        INICIO: '2026-03-01 00:00:00.000',
        FIN: '2026-11-30 00:00:00.000',
      },
    ])

    expect(periodos).toHaveLength(2)
    expect(periodos[0]).toMatchObject({
      periodo: '144',
      inicio: '2026-03-01',
      fin: '2026-11-30',
      sesiones: '2026-03-01',
    })
    expect(periodos[1]).toMatchObject({
      periodo: '143',
      inicio: '2025-03-01',
      fin: '2026-02-28',
      sesiones: '2025-03-01',
    })
    expect(periodos[1]!.tramos).toHaveLength(2)
  })
})

describe('crawlPeriodos (red)', () => {
  it(
    'descarga JSON HCDN, agrega y persiste /diputados/periodos',
    async () => {
      const data = await crawlPeriodos()
      expect(data.periodos.length).toBeGreaterThan(10)
      expect(data.periodos[0]?.periodo).toMatch(/^\d+$/)
      expect(data.periodos[0]?.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const persisted = JSON.parse(readEndpoint('/diputados/periodos') || '{}')
      expect(persisted.periodos?.length).toBe(data.periodos.length)
      const lista = JSON.parse(readEndpoint('/diputados/periodos/lista') || '[]')
      expect(lista.length).toBe(data.periodos.length)
    },
    60_000,
  )
})
