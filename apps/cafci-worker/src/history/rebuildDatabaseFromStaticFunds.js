import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabasePath } from '../config.js'
import { FundDetailsJobRepository } from '../database/fundDetailsJobRepository.js'
import { normalizarPayloadFondo } from '../utils/normalizarPayloadFondo.js'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(currentDirectory, '../../../..')

function getStaticFundsRoot() {
  return resolve(repositoryRoot, 'datos', 'v1', 'finanzas', 'fci', 'fondos')
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
} = {}) {
  for (const path of [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ]) {
    rmSync(path, {
      force: true,
    })
  }

  const repository = new FundDetailsJobRepository(databasePath)
  await repository.initialize()

  try {
    const fetchedAt = new Date().toISOString()
    let importedCurrentFunds = 0

    for (const { slug, indexPath } of listStaticFundIndexFiles(
      staticFundsRoot,
    )) {
      const payload = JSON.parse(readFileSync(indexPath, 'utf8'))
      const normalized = {
        ...normalizarPayloadFondo({ ...payload, slug }),
        slug,
        nombre: payload.nombre ?? payload.name ?? slug,
      }

      if (!normalized.fondoId || !normalized.claseId) {
        continue
      }

      repository.upsertCurrentFundDetail(normalized, fetchedAt)
      importedCurrentFunds += 1
    }

    return {
      databasePath,
      importedCurrentFunds,
    }
  } finally {
    repository.close()
  }
}
