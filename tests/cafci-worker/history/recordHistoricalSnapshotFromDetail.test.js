import { join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { FundDetailsJobRepository } from '../../../apps/cafci-worker/src/database/fundDetailsJobRepository.js'
import { recordHistoricalSnapshotFromDetail } from '../../../apps/cafci-worker/src/history/recordHistoricalSnapshotFromDetail.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

function createTempDb() {
  const directory = mkdtempSync(join(tmpdir(), 'cafci-history-current-'))
  const path = join(directory, 'db.sqlite')
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  return path
}

describe('recordHistoricalSnapshotFromDetail', () => {
  it('agrega el snapshot actual y deriva retorno/flujo usando el snapshot histórico previo', async () => {
    const dbPath = createTempDb()
    const repository = new FundDetailsJobRepository(dbPath)
    await repository.initialize()

    repository.upsertHistoricalSnapshot({
      slug: 'mercado-fondo-clase-a',
      fondoId: null,
      claseId: null,
      nombre: 'Mercado Fondo - Clase A',
      fecha: '2026-05-20',
      categoriaKey: 'mercadoDinero',
      categoria: 'Mercado de Dinero',
      horizonte: 'corto',
      valorCuotaparte: 100,
      patrimonio: 1000,
      retornoDiario: null,
      retornoAcumulado: 0,
      flujoEstimado: null,
      origen: 'legacy-json',
      fuenteOriginal: { from: 'test' },
    })

    await recordHistoricalSnapshotFromDetail(repository, {
      fondoId: '798',
      claseId: '1982',
      slug: 'mercado-fondo-clase-a',
      nombre: 'Mercado Fondo - Clase A',
      fecha: '2026-05-21',
      tipoRenta: 'Mercado de Dinero',
      horizonte: 'Corto Plazo',
      patrimonio: 1025,
      rendimientos: {
        valorCuotaparte: 101,
      },
    })

    const rows = repository.listHistoricalSnapshotsBySlug(
      'mercado-fondo-clase-a',
    )

    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      fondoId: '798',
      claseId: '1982',
      fecha: '2026-05-21',
      categoriaKey: 'mercadoDinero',
      categoria: 'Mercado de Dinero',
      valorCuotaparte: 101,
      patrimonio: 1025,
      retornoDiario: 1,
      retornoAcumulado: 1,
      flujoEstimado: 15,
      origen: 'cafci-detail',
    })

    repository.close()
  })
})
