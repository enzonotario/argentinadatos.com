import { pathToFileURL } from 'node:url'
import { createPocketBaseClient } from './client.js'
import { CAUCIONES_COLLECTION } from './migrations/001_cauciones.js'

async function ensureCollection(pb, definition) {
  try {
    const existing = await pb.getCollection(definition.name)
    console.log(`[worker:migrate] collection already exists: ${definition.name}`, {
      id: existing.id,
    })
    return { created: false, collection: existing }
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
  return { created: true, collection }
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
