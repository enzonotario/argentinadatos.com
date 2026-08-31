import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { createPocketBaseClient } from './client.js'
import { appliedAtNow } from './dates.js'
import { PRIVATE_RULES, dateField, textField } from './schema/fields.js'
import { migrations } from './migrations/index.js'
import { listAllRecords } from './records.js'

const thisDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(thisDir, '../../..')
loadDotenv({ path: resolve(repoRoot, '.env') })

const MIGRATIONS_COLLECTION = {
  name: 'worker_migrations',
  type: 'base',
  ...PRIVATE_RULES,
  fields: [
    textField('name', { required: true }),
    dateField('appliedAt', { required: true }),
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
  const rows = await listAllRecords(pb, 'worker_migrations', { sort: 'name' })
  for (const row of rows) {
    if (row.name) names.add(row.name)
  }
  return names
}

/**
 * Borra colección cauciones + historial de migraciones y vuelve a migrar.
 * Uso: node .../migrate.js --fresh
 */
export async function resetCaucionesAndMigrate(pb = createPocketBaseClient()) {
  await ensureMigrationsCollection(pb)

  try {
    await pb.deleteCollection('cauciones')
    console.log('[migrate:fresh] deleted collection cauciones')
  } catch (err) {
    if (err?.response?.status !== 404) throw err
    console.log('[migrate:fresh] cauciones did not exist')
  }

  const records = await listAllRecords(pb, 'worker_migrations')
  for (const row of records) {
    await pb.deleteRecord('worker_migrations', row.id)
  }
  if (records.length > 0) {
    console.log(
      `[migrate:fresh] cleared ${records.length} worker_migrations row(s)`,
    )
  }

  return runMigrations(pb)
}

/**
 * Corre migraciones pendientes en orden.
 */
export async function runMigrations(pb = createPocketBaseClient()) {
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
