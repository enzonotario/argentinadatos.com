import { pathToFileURL } from 'node:url'
import {
  resetCaucionesAndMigrate,
  runMigrations,
} from '@argentinadatos/pocketbase'

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

export { runMigrations, resetCaucionesAndMigrate }
