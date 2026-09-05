import { describe, expect, it } from 'vitest'
import {
  listChronologicalCnvDocuments,
  pickLatestAvailableDocument,
} from '../../../apps/cafci-worker/src/cnv/cnvClient.js'

describe('listChronologicalCnvDocuments', () => {
  const documents = [
    { documentDate: '2026-08-14', receptionAt: '2026-08-14T12:00:00.000Z', presentationId: 'old' },
    { documentDate: '2020-01-02', receptionAt: '2020-01-02T12:00:00.000Z', presentationId: 'first' },
    { documentDate: '2026-08-14', receptionAt: '2026-08-14T18:00:00.000Z', presentationId: 'latest' },
    { documentDate: null, presentationId: 'undated' },
    { documentDate: '2024-06-10', receptionAt: '2024-06-10T12:00:00.000Z', presentationId: 'mid' },
  ]

  it('deja un documento por día, el de recepción más nueva, en orden cronológico', () => {
    const listed = listChronologicalCnvDocuments(documents)

    expect(listed.map(item => item.presentationId)).toEqual([
      'first',
      'mid',
      'latest',
    ])
  })

  it('filtra por from/to', () => {
    const listed = listChronologicalCnvDocuments(documents, {
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
    })

    expect(listed.map(item => item.presentationId)).toEqual(['mid'])
  })

  it('pickLatestAvailableDocument usa el último día del listado', () => {
    expect(pickLatestAvailableDocument(documents).presentationId).toBe('latest')
  })

  it('elige la recepción más nueva cuando hay dos informes el mismo día', () => {
    const listed = listChronologicalCnvDocuments([
      {
        documentDate: '2026-09-03',
        presentationId: 'evening',
        receptionAt: '2026-09-03T23:20:00.000Z',
        documentId: '7-3566358-D',
      },
      {
        documentDate: '2026-09-03',
        presentationId: 'next-day',
        receptionAt: '2026-09-04T17:51:00.000Z',
        documentId: '7-3566576-D',
      },
    ])

    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({
      presentationId: 'next-day',
      documentId: '7-3566576-D',
    })
  })
})
