import { pathToFileURL } from 'node:url'
import { createPocketBaseClient } from './client.js'
import { CAUCIONES_COLLECTION } from './migrations/001_cauciones.js'

async function ensureCollection(pb, definition) {
  try {
    const existing = await pb.getCollection(definition.name)
    const existingFields = existing.fields ?? []
    const fieldNames = new Set(existingFields.map(f => f.name))
    const missing = definition.fields.filter(f => !fieldNames.has(f.name))

    if (missing.length === 0) {
      console.log(`[worker:migrate] collection already exists: ${definition.name}`, {
        id: existing.id,
      })
      return { created: false, updated: false, collection: existing }
    }

    // Truncate before adding required-ish columns so old rows no bloqueen el schema.
    await pb.truncateCollection(definition.name)

    const systemFields = existingFields.filter(f => f.system)
    const kept = existingFields.filter(f => !f.system)
    const keptNames = new Set(kept.map(f => f.name))
    const fields = [
      ...systemFields,
      ...kept,
      ...definition.fields.filter(f => !keptNames.has(f.name)),
    ]

    const updated = await pb.updateCollection(definition.name, {
      fields,
      indexes: definition.indexes,
    })
    console.log(`[worker:migrate] updated collection fields: ${definition.name}`, {
      id: updated.id,
      added: missing.map(f => f.name),
    })
    return { created: false, updated: true, collection: updated }
  } catch (err) {
    const status = err?.response?.status
    if (status !== 404) {
      throw err
    }
  }

  const collection = await pb.createCollection(definition)
  console.log(`[worker:migrate] created collection: ${definition.name}`, {
    id: collection.id,
  })
  return { created: true, updated: false, collection }
}

export async function runMigrations() {
  const pb = createPocketBaseClient()
  const results = []
  results.push(await ensureCollection(pb, CAUCIONES_COLLECTION))
  return results
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  try {
    await runMigrations()
  } catch (err) {
    console.error('[worker:migrate] failed', err?.response?.data || err)
    process.exit(1)
  }
}
