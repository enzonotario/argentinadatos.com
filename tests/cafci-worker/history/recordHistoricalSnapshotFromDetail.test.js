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
      fundId: null,
      classId: null,
      name: 'Mercado Fondo - Clase A',
      sourceDate: '2026-05-20',
      categoryKey: 'mercadoDinero',
      categoryLabel: 'Mercado de Dinero',
      horizon: 'corto',
      shareValue: 100,
      assetsUnderManagement: 1000,
      dailyReturn: null,
      cumulativeReturn: 0,
      estimatedNetFlow: null,
      sourceKind: 'legacy-json',
      rawSource: { from: 'test' },
    })

    await recordHistoricalSnapshotFromDetail(repository, {
      fundId: '798',
      classId: '1982',
      slug: 'mercado-fondo-clase-a',
      name: 'Mercado Fondo - Clase A',
      date: '2026-05-21',
      incomeType: 'Mercado de Dinero',
      horizon: 'Corto Plazo',
      assetsUnderManagement: 1025,
      performance: {
        shareValue: 101,
      },
    })

    const rows = repository.listHistoricalSnapshotsBySlug(
      'mercado-fondo-clase-a',
    )

    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      fundId: '798',
      classId: '1982',
      sourceDate: '2026-05-21',
      categoryKey: 'mercadoDinero',
      categoryLabel: 'Mercado de Dinero',
      shareValue: 101,
      assetsUnderManagement: 1025,
      dailyReturn: 1,
      cumulativeReturn: 1,
      estimatedNetFlow: 15,
      sourceKind: 'cafci-detail',
    })

    repository.close()
  })
})
