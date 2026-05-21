import { downloadDatabaseBackupFromR2 } from '../r2/downloadDatabaseBackupFromR2.js'

const downloaded = await downloadDatabaseBackupFromR2({
  failIfMissing: true,
})

if (!downloaded) {
  throw new Error('CAFCI worker R2 backup is not configured or unavailable')
}
