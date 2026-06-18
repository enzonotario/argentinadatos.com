import { parseWorkerArgs, runCafciWorker } from '../runCafciWorker.js'

const { forceRetryFailed } = parseWorkerArgs()

await runCafciWorker({
  watchMode: false,
  forceRetryFailed,
})
