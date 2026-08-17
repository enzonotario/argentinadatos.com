import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  cnvExcelCacheFileName,
  fetchCnvDocumentExcelCached,
} from '../../../apps/cafci-worker/src/cnv/fetchCnvDocumentExcelCached.js'

describe('fetchCnvDocumentExcelCached', () => {
  it('descarga una vez y reutiliza el Excel en disco', async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), 'cafci-excel-cache-'))
    const document = {
      documentDate: '2020-01-02',
      presentationId: 'abc',
    }
    let downloads = 0

    const download = async doc => {
      downloads += 1
      return {
        buffer: Buffer.from(`excel-${doc.documentDate}`),
        fileName: 'planilla.xlsx',
        document: doc,
      }
    }

    const first = await fetchCnvDocumentExcelCached(document, {
      cacheDir,
      download,
    })
    const second = await fetchCnvDocumentExcelCached(document, {
      cacheDir,
      download,
    })

    expect(downloads).toBe(1)
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    expect(second.buffer.toString()).toBe('excel-2020-01-02')
    expect(
      readFileSync(join(cacheDir, cnvExcelCacheFileName(document))).toString(),
    ).toBe('excel-2020-01-02')
  })
})
