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

  it('fresh recorre las fechas CNV disponibles de más vieja a más nueva', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository)
    const ingested = []
    service.ingestCnvDocument = async document => {
      ingested.push(document.documentDate)
      return { documentDate: document.documentDate, upserted: 1 }
    }

    const summary = await service.fresh({
      documents: [
        {
          documentDate: '2026-08-14',
          receptionAt: '2026-08-14T12:00:00.000Z',
        },
        {
          documentDate: '2020-01-02',
          receptionAt: '2020-01-02T12:00:00.000Z',
        },
        {
          documentDate: '2026-08-14',
          receptionAt: '2026-08-14T18:00:00.000Z',
        },
        { documentDate: null },
      ],
    })

    expect(summary.fromDate).toBe('2020-01-02')
    expect(summary.toDate).toBe('2026-08-14')
    expect(summary.ingested).toBe(2)
    expect(ingested).toEqual(['2020-01-02', '2026-08-14'])
  })
})
