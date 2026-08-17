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
    service.fetchDocumentExcel = async document => ({
      buffer: Buffer.from(''),
      fileName: 'dummy.xlsx',
      document,
    })
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
    expect(summary.skippedExisting).toBe(0)
    expect(ingested).toEqual(['2020-01-02', '2026-08-14'])
  })

  it('fresh salta fechas ya ingestadas para poder reanudar', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    temp.repository.markCnvDateIngested('2020-01-02')

    const service = new FundDetailsSyncService(temp.repository)
    const ingested = []
    service.fetchDocumentExcel = async document => ({
      buffer: Buffer.from(''),
      fileName: 'dummy.xlsx',
      document,
    })
    service.ingestCnvDocument = async document => {
      ingested.push(document.documentDate)
      return { documentDate: document.documentDate, upserted: 1 }
    }

    const summary = await service.fresh({
      documents: [
        {
          documentDate: '2020-01-02',
          receptionAt: '2020-01-02T12:00:00.000Z',
        },
        {
          documentDate: '2026-08-14',
          receptionAt: '2026-08-14T18:00:00.000Z',
        },
      ],
    })

    expect(summary.ingested).toBe(1)
    expect(summary.skippedExisting).toBe(1)
    expect(ingested).toEqual(['2026-08-14'])
  })

  it('en backfill calcula flujo en memoria y no relee toda la historia', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository)
    const listCalls = []
    const originalList = temp.repository.listHistoricalSnapshotsBySlug.bind(
      temp.repository,
    )
    temp.repository.listHistoricalSnapshotsBySlug = slug => {
      listCalls.push(slug)
      return originalList(slug)
    }

    const previousBySlug = new Map()
    const firstBySlug = new Map()
    const currentByClassId = new Map()

    const fundRow = (fecha, valorCuotaparte, patrimonio) => ({
      claseId: '1982',
      fecha,
      nombre: 'Mercado Fondo Clase A',
      valorCuotaparte,
      patrimonio,
      tipoRenta: 'Mercado de Dinero',
    })

    await service.ingestCnvDocument(
      { documentDate: '2020-01-02', presentationId: 'p1' },
      {
        parsed: { funds: [fundRow('2020-01-02', 100, 1000)] },
        downloaded: { fileName: 'a.xlsx', buffer: Buffer.from('') },
        skipRollingHistory: true,
        persistFuenteOriginal: false,
        previousBySlug,
        firstBySlug,
        currentByClassId,
      },
    )
    await service.ingestCnvDocument(
      { documentDate: '2020-01-03', presentationId: 'p2' },
      {
        parsed: { funds: [fundRow('2020-01-03', 101, 1025)] },
        downloaded: { fileName: 'b.xlsx', buffer: Buffer.from('') },
        skipRollingHistory: true,
        persistFuenteOriginal: false,
        previousBySlug,
        firstBySlug,
        currentByClassId,
      },
    )

    const funds = temp.repository.getCurrentFunds()
    expect(funds).toHaveLength(1)
    const snapshots = originalList(funds[0].slug)

    expect(listCalls).toEqual([])
    expect(snapshots).toHaveLength(2)
    expect(snapshots[1]).toMatchObject({
      fecha: '2020-01-03',
      valorCuotaparte: 101,
      patrimonio: 1025,
      retornoDiario: 1,
      flujoEstimado: 15,
      fuenteOriginal: null,
    })
    expect(temp.repository.getWorkerState('cnv_ingested:2020-01-02')).toBe('1')
    expect(temp.repository.getWorkerState('cnv_ingested:2020-01-03')).toBe('1')
  })
})
