import { getPollIntervalMs } from './config.js'
import { syncCauciones } from './jobs/syncCauciones.js'
import { runMigrations } from './pocketbase/migrate.js'

export function parseWorkerArgs(argv = process.argv.slice(2)) {
  return {
    watchMode: argv.includes('--watch'),
  }
}

export async function runIolWorker({ watchMode = false } = {}) {
  console.log('[worker] running pocketbase migrations')
  await runMigrations()

  const runOnce = async () => {
    const started = Date.now()
    console.log('[worker] sync cauciones starting')
    const summary = await syncCauciones()
    console.log('[worker] sync cauciones done', {
      ...summary,
      durationMs: Date.now() - started,
    })
    return summary
  }

  if (!watchMode) {
    return runOnce()
  }

  const intervalMs = getPollIntervalMs()
  console.log('[worker] starting daemon mode', { intervalMs })

  let stopped = false
  let timer = null

  const shutdown = () => {
    stopped = true
    if (timer) clearTimeout(timer)
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  const loop = async () => {
    while (!stopped) {
      try {
        await runOnce()
      } catch (err) {
        console.error('[worker] sync failed', err?.response?.data || err)
      }
      if (stopped) break
      await new Promise(resolve => {
        timer = setTimeout(resolve, intervalMs)
      })
    }
  }

  await loop()
}
