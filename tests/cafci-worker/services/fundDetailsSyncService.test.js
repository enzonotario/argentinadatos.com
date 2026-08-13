import { afterEach, describe, expect, it } from 'vitest'
import { FundDetailsSyncService } from '../../../apps/cafci-worker/src/services/fundDetailsSyncService.js'
import {
  createTempRepository,
  expectValidFundPayload,
} from '../helpers/fundDetailsSyncService.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

describe('FundDetailsSyncService CNV', () => {
  it('ingesta la planilla CNV más reciente y persiste fondos actuales', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository)
    const summary = await service.runCycle()

    expect(summary.source).toBe('cnv')
    expect(summary.upserted).toBeGreaterThan(1000)
    expect(summary.currentFunds).toBe(summary.upserted)

    const mercado = temp.repository
      .getCurrentFunds()
      .find(fund => fund.claseId === '1982' || /mercado-fondo/i.test(fund.slug))

    expect(mercado).toBeTruthy()
    expectValidFundPayload(mercado)
    expect(mercado.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(temp.repository.countHistoricalSnapshots()).toBeGreaterThan(1000)
  }, 180_000)

  it('puede backfillear un día puntual', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository)
    const summary = await service.backfill({
      fromDate: '2026-08-12',
      toDate: '2026-08-12',
    })

    expect(summary.ingested).toBe(1)
    expect(summary.currentFunds).toBeGreaterThan(1000)
  }, 180_000)
})
