import Database from 'better-sqlite3'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { FundDetailsJobRepository } from '../../../apps/cafci-worker/src/database/fundDetailsJobRepository.js'
import { backfillHistoricalSnapshots } from '../../../apps/cafci-worker/src/history/backfillHistoricalSnapshots.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

function createTempDb() {
  const directory = mkdtempSync(join(tmpdir(), 'cafci-history-db-'))
  const path = join(directory, 'db.sqlite')
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))
  return path
}

function createLegacyTree() {
  const directory = mkdtempSync(join(tmpdir(), 'cafci-history-legacy-'))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))

  const dayOneDir = join(directory, 'mercadoDinero', '2026', '05', '20')
  const dayTwoDir = join(directory, 'mercadoDinero', '2026', '05', '21')
  mkdirSync(dayOneDir, { recursive: true })
  mkdirSync(dayTwoDir, { recursive: true })

  writeFileSync(
    join(dayOneDir, 'index.json'),
    JSON.stringify([
      {
        fondo: 'Mercado Fondo - Clase A',
        horizonte: 'corto',
        fecha: '2026-05-20',
        vcp: 100,
        ccp: 0,
        patrimonio: 1000,
      },
    ]),
  )

  writeFileSync(
    join(dayTwoDir, 'index.json'),
    JSON.stringify([
      {
        fondo: 'Mercado Fondo - Clase A',
        horizonte: 'corto',
        fecha: '2026-05-21',
        vcp: 101,
        ccp: 0,
        patrimonio: 1025,
      },
    ]),
  )

  return directory
}

function createLegacyTreeWithNullDate() {
  const directory = mkdtempSync(join(tmpdir(), 'cafci-history-legacy-null-date-'))
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }))

  const dayDir = join(directory, 'mercadoDinero', '2024', '01', '02')
  mkdirSync(dayDir, { recursive: true })

  writeFileSync(
    join(dayDir, 'index.json'),
    JSON.stringify([
      {
        fondo: 'Region: Argentina',
        fecha: null,
        vcp: null,
        ccp: null,
        patrimonio: 13684093833197.47,
      },
    ]),
  )

  return directory
}

describe('backfillHistoricalSnapshots', () => {
  it('importa históricos legacy y deriva retornos/flujo cuando hay evidencia suficiente', async () => {
    const dbPath = createTempDb()
    const legacyRoot = createLegacyTree()
    const repository = new FundDetailsJobRepository(dbPath)
    await repository.initialize()

    await backfillHistoricalSnapshots(repository, {
      legacyRoot,
    })

    const rows = repository.listHistoricalSnapshotsBySlug(
      'mercado-fondo-clase-a',
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      sourceDate: '2026-05-20',
      categoryKey: 'mercadoDinero',
      categoryLabel: 'Mercado de Dinero',
      shareValue: 100,
      assetsUnderManagement: 1000,
      dailyReturn: null,
      cumulativeReturn: 0,
      estimatedNetFlow: null,
      sourceKind: 'legacy-json',
    })
    expect(rows[1]).toMatchObject({
      sourceDate: '2026-05-21',
      shareValue: 101,
      assetsUnderManagement: 1025,
      dailyReturn: 1,
      cumulativeReturn: 1,
      estimatedNetFlow: 15,
    })

    repository.close()
  })

  it('ignora registros legacy con fecha nula en el histórico', async () => {
    const dbPath = createTempDb()
    const legacyRoot = createLegacyTreeWithNullDate()
    const repository = new FundDetailsJobRepository(dbPath)
    await repository.initialize()

    const imported = await backfillHistoricalSnapshots(repository, {
      legacyRoot,
    })

    const rows = repository.listHistoricalSnapshotsBySlug('region-argentina')

    expect(imported).toBe(0)
    expect(rows).toEqual([])

    repository.close()
  })

  it('reanuda el backfill si hay snapshots parciales de una corrida interrumpida', async () => {
    const dbPath = createTempDb()
    const legacyRoot = createLegacyTree()
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
      rawSource: null,
    })

    await backfillHistoricalSnapshots(repository, {
      legacyRoot,
    })

    const rows = repository.listHistoricalSnapshotsBySlug(
      'mercado-fondo-clase-a',
    )

    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({
      sourceDate: '2026-05-21',
      shareValue: 101,
      assetsUnderManagement: 1025,
    })

    repository.close()
  })
})
