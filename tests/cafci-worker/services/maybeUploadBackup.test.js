import { describe, expect, it } from 'vitest'
import { FundDetailsSyncService } from '../../../apps/cafci-worker/src/services/fundDetailsSyncService.js'
import { createTempRepository } from '../helpers/fundDetailsSyncService.js'

describe('FundDetailsSyncService.maybeUploadBackup', () => {
  it('omite la subida cuando todavía no corresponde', async () => {
    const temp = await createTempRepository()

    try {
      temp.repository.setWorkerState(
        'last_r2_backup_at',
        new Date().toISOString(),
      )

      const service = new FundDetailsSyncService(temp.repository, {
        r2UploadIntervalMs: 60_000,
      })

      const uploaded = await service.maybeUploadBackup()
      expect(uploaded).toBe(false)
    } finally {
      temp.cleanup()
    }
  })
})
