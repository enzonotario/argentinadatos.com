import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { FundDetailsJobRepository } from '../../../apps/cafci-worker/src/database/fundDetailsJobRepository.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

function createTempDbPath(name) {
  const directory = mkdtempSync(join(tmpdir(), `${name}-`))
  const path = join(directory, 'db.sqlite')
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  return path
}

describe('importHistoricalBackfillFromDatabase', () => {
  it('importa snapshots históricos desde una sqlite seed a la sqlite productiva', async () => {
    const seedPath = createTempDbPath('cafci-seed-db')
    const targetPath = createTempDbPath('cafci-target-db')

    const seedRepository = new FundDetailsJobRepository(seedPath)
    await seedRepository.initialize()
    seedRepository.upsertHistoricalSnapshot({
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
      rawSource: null,
    })
    seedRepository.markHistoricalBackfillCompleted('2026-05-22T00:00:00.000Z')
    seedRepository.close()

    const targetRepository = new FundDetailsJobRepository(targetPath)
    await targetRepository.initialize()

    const imported = targetRepository.importHistoricalBackfillFromDatabase(
      seedPath,
    )

    expect(imported).toBe(1)
    expect(targetRepository.countHistoricalSnapshots()).toBe(1)
    expect(targetRepository.isHistoricalBackfillCompleted()).toBe(true)
    expect(
      targetRepository.listHistoricalSnapshotsBySlug('mercado-fondo-clase-a')[0],
    ).toMatchObject({
      sourceDate: '2026-05-20',
      name: 'Mercado Fondo - Clase A',
      shareValue: 100,
    })

    targetRepository.close()
  })
})
