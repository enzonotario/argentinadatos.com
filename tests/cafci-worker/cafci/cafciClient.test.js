import { describe, expect, it } from 'vitest'
import { fetchFundDetail } from '../../../apps/cafci-worker/src/cafci/cafciClient.js'
import { expectValidFundPayload } from '../helpers/fundDetailsSyncService.js'

// Para inspeccionar el payload de un fondo puntual:
// pnpm vitest run tests/cafci-worker/cafci/cafciClient.test.js -t "442/5127"
describe('fetchFundDetail', () => {
  it(
    'obtiene el detalle del fondo 442/5127',
    async () => {
      const payload = await fetchFundDetail('442', '5127')

      expect(payload).not.toBeNull()
      expect(payload.fondoId).toBe('442')
      expect(payload.claseId).toBe('5127')
      expectValidFundPayload(payload)
    },
    120_000,
  )
})
