import { expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { FundDetailsJobRepository } from '../../../apps/cafci-worker/src/database/fundDetailsJobRepository.js'

export async function createTempRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'cafci-sync-service-'))
  const dbPath = join(directory, 'db.sqlite')
  const repository = new FundDetailsJobRepository(dbPath)
  await repository.initialize()

  return {
    repository,
    cleanup: () => {
      repository.close()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}

export function expectValidFundPayload(payload) {
  expect(payload).toBeTypeOf('object')
  expect(payload.fondoId).toBeTypeOf('string')
  expect(payload.fondoId.length).toBeGreaterThan(0)
  expect(payload.claseId).toBeTypeOf('string')
  expect(payload.claseId.length).toBeGreaterThan(0)
  expect(payload.slug).toBeTypeOf('string')
  expect(payload.nombre).toBeTypeOf('string')
  expect(payload.rendimientos).toBeTypeOf('object')

  if (payload.fecha) {
    expect(payload.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  }

  if (payload.rendimientos.valorCuotaparte != null) {
    expect(payload.rendimientos.valorCuotaparte).toBeTypeOf('number')
  }
}
