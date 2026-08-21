import { parseWorkerArgs, runIolWorker } from './runWorker.js'

try {
  await runIolWorker(parseWorkerArgs())
} catch (err) {
  console.error('[worker] fatal', err?.response?.data || err)
  process.exit(1)
}
