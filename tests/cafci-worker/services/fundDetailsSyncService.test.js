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

    temp.repository.markCnvDateIngested('2020-01-02', {
      presentationId: 'old-p',
    })

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
          presentationId: 'old-p',
          receptionAt: '2020-01-02T12:00:00.000Z',
        },
        {
          documentDate: '2026-08-14',
          presentationId: 'new-p',
          receptionAt: '2026-08-14T18:00:00.000Z',
        },
      ],
    })

    expect(summary.ingested).toBe(1)
    expect(summary.skippedExisting).toBe(1)
    expect(ingested).toEqual(['2026-08-14'])
  })

  it('fresh re-ingiere si la misma fecha tiene otra presentationId (corrección CNV)', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    temp.repository.markCnvDateIngested('2026-02-27', {
      presentationId: 'original',
      receptionAt: '2026-02-28T12:00:00.000Z',
    })

    const service = new FundDetailsSyncService(temp.repository)
    const ingested = []
    service.fetchDocumentExcel = async document => ({
      buffer: Buffer.from(''),
      fileName: 'dummy.xlsx',
      document,
    })
    service.ingestCnvDocument = async document => {
      ingested.push(document.presentationId)
      return { documentDate: document.documentDate, upserted: 1 }
    }

    const summary = await service.fresh({
      documents: [
        {
          documentDate: '2026-02-27',
          presentationId: 'original',
          receptionAt: '2026-02-28T12:00:00.000Z',
        },
        {
          documentDate: '2026-02-27',
          presentationId: 'updated-may',
          receptionAt: '2026-05-13T18:10:00.000Z',
        },
      ],
    })

    expect(summary.ingested).toBe(1)
    expect(summary.skippedExisting).toBe(0)
    expect(ingested).toEqual(['updated-may'])
  })

  it('runCycle re-ingiere republicaciones de fechas ya vistas', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    temp.repository.markCnvDateIngested('2026-06-30', {
      presentationId: 'old-jun',
      receptionAt: '2026-07-01T12:00:00.000Z',
    })
    temp.repository.markCnvDateIngested('2026-09-04', {
      presentationId: 'sep4-v1',
      receptionAt: '2026-09-04T20:00:00.000Z',
    })
    // Marca legacy: correcciones recientes deben re-chequearse.
    temp.repository.markCnvDateIngested('2026-02-27')

    const service = new FundDetailsSyncService(temp.repository)
    const ingested = []
    service.ingestCnvDocument = async document => {
      ingested.push({
        date: document.documentDate,
        presentationId: document.presentationId,
      })
      return {
        documentDate: document.documentDate,
        presentationId: document.presentationId,
        upserted: 1,
        parsedFunds: 1,
      }
    }

    const documents = [
      {
        documentDate: '2026-02-27',
        presentationId: 'feb-updated-may',
        receptionAt: '2026-09-01T15:10:00.000Z',
      },
      {
        documentDate: '2026-06-30',
        presentationId: 'old-jun',
        receptionAt: '2026-07-01T12:00:00.000Z',
      },
      {
        documentDate: '2026-06-30',
        presentationId: 'jun-republished',
        receptionAt: '2026-09-01T18:16:00.000Z',
      },
      {
        documentDate: '2026-09-03',
        presentationId: 'sep3-evening',
        receptionAt: '2026-09-03T23:20:00.000Z',
      },
      {
        documentDate: '2026-09-03',
        presentationId: 'sep3-next-day',
        receptionAt: '2026-09-04T17:51:00.000Z',
      },
      {
        documentDate: '2026-09-04',
        presentationId: 'sep4-v2',
        receptionAt: '2026-09-05T12:00:00.000Z',
      },
    ]

    const selected = service.selectDocumentsForCycle(documents, {
      now: Date.parse('2026-09-05T15:00:00.000Z'),
    })
    expect(selected.map(d => d.presentationId)).toEqual([
      'feb-updated-may',
      'jun-republished',
      'sep4-v2',
    ])

    for (const document of selected) {
      await service.ingestCnvDocument(document)
    }

    expect(ingested).toEqual([
      { date: '2026-02-27', presentationId: 'feb-updated-may' },
      { date: '2026-06-30', presentationId: 'jun-republished' },
      { date: '2026-09-04', presentationId: 'sep4-v2' },
    ])
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
    expect(temp.repository.getWorkerState('cnv_ingested:2020-01-02')).toEqual(
      JSON.stringify({
        presentationId: 'p1',
        documentId: null,
        receptionAt: null,
      }),
    )
    expect(temp.repository.getWorkerState('cnv_ingested:2020-01-03')).toEqual(
      JSON.stringify({
        presentationId: 'p2',
        documentId: null,
        receptionAt: null,
      }),
    )
  })

  it('desambigua slugs cuando un nombre choca con un fondo ya persistido', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository)
    const currentByClassId = new Map()
    const currentBySlug = new Map()

    const ingest = (documentDate, funds) =>
      service.ingestCnvDocument(
        { documentDate, presentationId: documentDate },
        {
          parsed: { funds },
          downloaded: {
            fileName: `${documentDate}.xlsx`,
            buffer: Buffer.from(''),
          },
          skipRollingHistory: true,
          persistFuenteOriginal: false,
          currentByClassId,
          currentBySlug,
          previousBySlug: new Map(),
          firstBySlug: new Map(),
          classIdToFondoId: new Map(),
        },
      )

    await ingest('2020-01-02', [
      {
        claseId: '1',
        fecha: '2020-01-02',
        nombre: 'Alpha',
        valorCuotaparte: 100,
        patrimonio: 1000,
      },
    ])
    await ingest('2026-01-09', [
      {
        claseId: '1',
        fecha: '2026-01-09',
        nombre: 'Alpha Clase A',
        valorCuotaparte: 101,
        patrimonio: 1010,
      },
      {
        claseId: '2',
        fecha: '2026-01-09',
        nombre: 'Alpha',
        valorCuotaparte: 50,
        patrimonio: 500,
      },
    ])

    const funds = temp.repository
      .getCurrentFunds()
      .sort((left, right) =>
        String(left.claseId).localeCompare(String(right.claseId)),
      )

    expect(funds).toHaveLength(2)
    expect(funds[0]).toMatchObject({
      claseId: '1',
      slug: 'alpha-clase-a',
      nombre: 'Alpha Clase A',
    })
    expect(funds[1]).toMatchObject({
      claseId: '2',
      slug: 'alpha',
      nombre: 'Alpha',
    })
    expect(
      temp.repository
        .listHistoricalSnapshotsBySlug('alpha-clase-a')
        .map(snapshot => snapshot.fecha),
    ).toEqual(['2020-01-02', '2026-01-09'])
    expect(
      temp.repository
        .listHistoricalSnapshotsBySlug('alpha')
        .map(snapshot => snapshot.fecha),
    ).toEqual(['2026-01-09'])
    expect(temp.repository.getWorkerState('cnv_ingested:2026-01-09')).toEqual(
      JSON.stringify({
        presentationId: '2026-01-09',
        documentId: null,
        receptionAt: null,
      }),
    )
  })

  it('conserva el slug interno si el del nombre actual ya pertenece a otra clase', async () => {
    const temp = await createTempRepository()
    cleanups.push(temp.cleanup)

    const service = new FundDetailsSyncService(temp.repository)
    const currentByClassId = new Map()
    const currentBySlug = new Map()

    const ingest = (documentDate, funds) =>
      service.ingestCnvDocument(
        { documentDate, presentationId: documentDate },
        {
          parsed: { funds },
          downloaded: {
            fileName: `${documentDate}.xlsx`,
            buffer: Buffer.from(''),
          },
          skipRollingHistory: true,
          persistFuenteOriginal: false,
          currentByClassId,
          currentBySlug,
          previousBySlug: new Map(),
          firstBySlug: new Map(),
          classIdToFondoId: new Map(),
        },
      )

    await ingest('2020-01-02', [
      {
        claseId: '3377',
        fecha: '2020-01-02',
        nombre: 'IEB Ahorro - Clase A',
        valorCuotaparte: 100,
        patrimonio: 1000,
      },
      {
        claseId: '9999',
        fecha: '2020-01-02',
        nombre: 'Ciclo Nova Ahorro - Clase A',
        valorCuotaparte: 50,
        patrimonio: 500,
      },
    ])
    await ingest('2026-01-09', [
      {
        claseId: '3377',
        fecha: '2026-01-09',
        nombre: 'Ciclo Nova Ahorro - Clase A',
        valorCuotaparte: 101,
        patrimonio: 1010,
      },
      {
        claseId: '9999',
        fecha: '2026-01-09',
        nombre: 'Ciclo Nova Ahorro - Clase A Extra',
        valorCuotaparte: 51,
        patrimonio: 510,
      },
    ])

    const funds = temp.repository
      .getCurrentFunds()
      .sort((left, right) =>
        String(left.claseId).localeCompare(String(right.claseId)),
      )

    expect(funds[0]).toMatchObject({
      claseId: '3377',
      slug: 'ieb-ahorro-clase-a',
      nombre: 'Ciclo Nova Ahorro - Clase A',
    })
    expect(funds[1]).toMatchObject({
      claseId: '9999',
      slug: 'ciclo-nova-ahorro-clase-a-extra',
      nombre: 'Ciclo Nova Ahorro - Clase A Extra',
    })
  })
})
