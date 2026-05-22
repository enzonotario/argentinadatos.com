import { rebuildDatabaseFromStaticFunds } from '../history/rebuildDatabaseFromStaticFunds.js'

const result = await rebuildDatabaseFromStaticFunds()

console.log('[cafci-worker] db.sqlite rebuilt from static fondos', result)
