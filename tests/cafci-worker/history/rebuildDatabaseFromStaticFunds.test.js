import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { FundDetailsJobRepository } from '../../../apps/cafci-worker/src/database/fundDetailsJobRepository.js'
import { rebuildDatabaseFromStaticFunds } from '../../../apps/cafci-worker/src/history/rebuildDatabaseFromStaticFunds.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

function createTempDirectory(prefix) {
  const directory = mkdtempSync(join(tmpdir(), `${prefix}-`))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

function createStaticFundsTree() {
  const root = createTempDirectory('cafci-static-funds')
  const fundDir = join(root, 'mercado-fondo-clase-a')
  mkdirSync(fundDir, { recursive: true })
  writeFileSync(
    join(fundDir, 'index.json'),
    JSON.stringify({
      fondoId: '798',
      claseId: '1982',
      nombre: 'Mercado Fondo - Clase A',
      fecha: '2026-05-21',
      tipoRenta: 'Mercado de Dinero',
      patrimonio: 1025,
      rendimientos: {
        valorCuotaparte: 101,
      },
    }),
  )

  return root
}

function createHistoricalSeedDatabase() {
  const databasePath = join(createTempDirectory('cafci-seed-db'), 'db.sqlite')

  return { databasePath }
}

describe('rebuildDatabaseFromStaticFunds', () => {
  it('reconstruye db.sqlite desde fondos estáticos e importa el histórico local', async () => {
    const databasePath = join(createTempDirectory('cafci-db'), 'db.sqlite')
    const staticFundsRoot = createStaticFundsTree()
    const seed = createHistoricalSeedDatabase()

    const seedRepository = new FundDetailsJobRepository(seed.databasePath)
    await seedRepository.initialize()
    seedRepository.upsertHistoricalSnapshot({
      slug: 'mercado-fondo-clase-a',
      fundId: '798',
      classId: '1982',
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
    seedRepository.markHistoricalBackfillCompleted()
    seedRepository.close()

    const result = await rebuildDatabaseFromStaticFunds({
      databasePath,
      staticFundsRoot,
      historicalSeedPath: seed.databasePath,
    })

    expect(result).toMatchObject({
      databasePath,
      importedCurrentFunds: 1,
      importedHistoricalSnapshots: 1,
    })

    const repository = new FundDetailsJobRepository(databasePath)
    await repository.initialize()

    expect(repository.getCurrentFunds()).toHaveLength(1)
    expect(repository.countHistoricalSnapshots()).toBe(1)
    expect(repository.isHistoricalBackfillCompleted()).toBe(true)

    repository.close()
  })
})
