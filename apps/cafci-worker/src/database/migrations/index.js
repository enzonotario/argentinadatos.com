import initialSchema from './001InitialSchema.js'
import historicalSnapshots from './002HistoricalSnapshots.js'
import workerState from './003WorkerState.js'

export const migrations = [initialSchema, historicalSnapshots, workerState]
