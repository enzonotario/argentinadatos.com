import { pathToFileURL } from 'node:url'
import { createPocketBaseClient } from './client.js'
import { migrations } from './migrations/index.js'

const MIGRATIONS_COLLECTION = {
  name: 'worker_migrations',
  type: 'base',
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'appliedAt',
      type: 'date',
      required: true,
    },
  ],
  indexes: [
    'CREATE UNIQUE INDEX idx_worker_migrations_name ON worker_migrations (name)',
  ],
}

async function ensureMigrationsCollection(pb) {
  try {
    await pb.getCollection('worker_migrations')
  } catch (err) {
    if (err?.response?.status !== 404) throw err
    await pb.createCollection(MIGRATIONS_COLLECTION)
    console.log('[migrate] created worker_migrations')
  }
}

async function listAppliedMigrationNames(pb) {
  const names = new Set()
  let page = 1
  const perPage = 200
  for (;;) {
    const result = await pb.listRecords('worker_migrations', {
      page,
      perPage,
      sort: 'name',
    })
    for (const row of result.items ?? []) {
      if (row.name) names.add(row.name)
    }
    if (page >= (result.totalPages ?? 1)) break
    page += 1
  }
  return names
}

async function listAllMigrationRecords(pb) {
  const items = []
  let page = 1
  const perPage = 200
  for (;;) {
    const result = await pb.listRecords('worker_migrations', {
      page,
      perPage,
    })
    items.push(...(result.items ?? []))
    if (page >= (result.totalPages ?? 1)) break
    page += 1
  }
  return items
}

function appliedAtNow() {
  return new Date().toISOString().replace('T', ' ')
}

/**
 * Borra colección cauciones + historial de migraciones del worker y vuelve a migrar.
 * Uso: node src/pocketbase/migrate.js --fresh
 */
export async function resetCaucionesAndMigrate() {
  const pb = createPocketBaseClient()
  await ensureMigrationsCollection(pb)

  try {
    await pb.deleteCollection('cauciones')
    console.log('[migrate:fresh] deleted collection cauciones')
  } catch (err) {
    if (err?.response?.status !== 404) throw err
    console.log('[migrate:fresh] cauciones did not exist')
  }

  const records = await listAllMigrationRecords(pb)
  for (const row of records) {
    await pb.deleteRecord('worker_migrations', row.id)
  }
  if (records.length > 0) {
    console.log(
      `[migrate:fresh] cleared ${records.length} worker_migrations row(s)`,
    )
  }

  return runMigrations()
}

/**
 * Corre migraciones pendientes en orden.
 * Cada migración es idempotente; el registro en `worker_migrations` evita reaplicarlas.
 */
export async function runMigrations() {
  const pb = createPocketBaseClient()
  await ensureMigrationsCollection(pb)
  const applied = await listAppliedMigrationNames(pb)
  const results = []

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      console.log(`[migrate] skip ${migration.id}`)
      results.push({ id: migration.id, status: 'skipped' })
      continue
    }

    console.log(`[migrate] apply ${migration.id}`)
    await migration.up(pb)
    await pb.createRecord('worker_migrations', {
      name: migration.id,
      appliedAt: appliedAtNow(),
    })
    results.push({ id: migration.id, status: 'applied' })
    console.log(`[migrate] done ${migration.id}`)
  }

  return results
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const fresh = process.argv.includes('--fresh')
  try {
    const results = fresh
      ? await resetCaucionesAndMigrate()
      : await runMigrations()
    console.log('[migrate] finished', results)
  } catch (err) {
    console.error('[migrate] failed', err?.response?.data || err)
    process.exit(1)
  }
}
