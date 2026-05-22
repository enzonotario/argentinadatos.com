import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBackfillSeedDatabasePath, getDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(currentDirectory, '../../../..')

function getStaticFundsRoot() {
  return resolve(repositoryRoot, 'datos', 'v1', 'finanzas', 'fci', 'fondos')
}

function normalizeStaticFundPayload(slug, payload) {
  return {
    ...payload,
    slug,
    fundId: payload.fundId ?? payload.fondoId ?? null,
    classId: payload.classId ?? payload.claseId ?? null,
    name: payload.name ?? payload.nombre ?? slug,
    date: payload.date ?? payload.fecha ?? null,
  }
}

function listStaticFundIndexFiles(rootDirectory) {
  if (!existsSync(rootDirectory)) {
    return []
  }

  return readdirSync(rootDirectory, {
    withFileTypes: true,
  })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      slug: entry.name,
      indexPath: join(rootDirectory, entry.name, 'index.json'),
    }))
    .filter(entry => existsSync(entry.indexPath))
    .sort((a, b) => a.slug.localeCompare(b.slug, 'es'))
}

export async function rebuildDatabaseFromStaticFunds({
  databasePath = getDatabasePath(),
  staticFundsRoot = getStaticFundsRoot(),
  historicalSeedPath = getBackfillSeedDatabasePath(),
} = {}) {
  for (const path of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    rmSync(path, {
      force: true,
    })
  }

  const repository = new FundDetailsJobRepository(databasePath)
  await repository.initialize()

  try {
    const fetchedAt = new Date().toISOString()
    let importedCurrentFunds = 0

    for (const { slug, indexPath } of listStaticFundIndexFiles(staticFundsRoot)) {
      const payload = JSON.parse(readFileSync(indexPath, 'utf8'))
      const normalized = normalizeStaticFundPayload(slug, payload)

      if (!normalized.fundId || !normalized.classId) {
        continue
      }

      repository.upsertCurrentFundDetail(normalized, fetchedAt)
      importedCurrentFunds += 1
    }

    const importedHistoricalSnapshots = existsSync(historicalSeedPath)
      ? repository.importHistoricalBackfillFromDatabase(historicalSeedPath)
      : 0

    return {
      databasePath,
      importedCurrentFunds,
      importedHistoricalSnapshots,
    }
  } finally {
    repository.close()
  }
}
