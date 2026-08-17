import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { downloadCnvDocumentExcel } from './cnvClient.js'
import { withRetry } from '../utils/withRetry.js'

export function cnvExcelCacheFileName(document) {
  const date = document?.documentDate || 'unknown-date'
  const presentationId = document?.presentationId || 'unknown'
  return `${date}-${presentationId}.xlsx`
}

export async function fetchCnvDocumentExcelCached(
  document,
  { cacheDir, download = downloadCnvDocumentExcel, attempts = 3 } = {},
) {
  if (!cacheDir) {
    return withRetry(() => download(document), { attempts })
  }

  const cachePath = join(cacheDir, cnvExcelCacheFileName(document))

  if (existsSync(cachePath)) {
    return {
      buffer: readFileSync(cachePath),
      fileName: basename(cachePath),
      blobId: null,
      document,
      fromCache: true,
    }
  }

  const downloaded = await withRetry(() => download(document), { attempts })
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cachePath, downloaded.buffer)

  return {
    ...downloaded,
    fromCache: false,
  }
}
