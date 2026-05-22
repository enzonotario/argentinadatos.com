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

describe('rebuildDatabaseFromStaticFunds', () => {
  it('reconstruye db.sqlite desde fondos estáticos', async () => {
    const databasePath = join(createTempDirectory('cafci-db'), 'db.sqlite')
    const staticFundsRoot = createStaticFundsTree()

    const result = await rebuildDatabaseFromStaticFunds({
      databasePath,
      staticFundsRoot,
    })

    expect(result).toMatchObject({
      databasePath,
      importedCurrentFunds: 1,
    })

    const repository = new FundDetailsJobRepository(databasePath)
    await repository.initialize()

    expect(repository.getCurrentFunds()).toEqual([
      expect.objectContaining({
        fondoId: '798',
        claseId: '1982',
        nombre: 'Mercado Fondo - Clase A',
        fecha: '2026-05-21',
      }),
    ])
    expect(repository.countHistoricalSnapshots()).toBe(0)

    repository.close()
  })
})
