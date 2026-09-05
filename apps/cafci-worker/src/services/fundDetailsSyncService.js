import {
  fetchCnvCuotaparteDocuments,
  listChronologicalCnvDocuments,
  pickLatestDocumentForDate,
} from '../cnv/cnvClient.js'
import { fetchCnvDocumentExcelCached } from '../cnv/fetchCnvDocumentExcelCached.js'
import { enrichComposicionCarteraFromCnv } from '../cnv/enrichComposicionCarteraFromCnv.js'
import { mapCnvRowToPayload } from '../cnv/mapCnvRowToPayload.js'
import { parseCnvCuotaparteExcel } from '../cnv/parseCnvExcel.js'
import {
  loadStaticClassIdToFondoIdMap,
  mergeClassIdMaps,
} from '../cnv/staticFundIdMap.js'
import {
  getComposicionEnrichLimit,
  getCnvExcelCacheDir,
  getFreshDownloadConcurrency,
  getPollIntervalMs,
  getR2UploadIntervalMs,
  isComposicionEnrichEnabled,
} from '../config.js'
import { recordHistoricalSnapshotFromDetailSync } from '../history/recordHistoricalSnapshotFromDetail.js'
import { uploadDatabaseBackupToR2 } from '../r2/uploadDatabaseBackupToR2.js'
import { allocateUniqueFundSlug } from '../utils/buildFundSlug.js'
import { createOrderedPrefetch } from '../utils/orderedPrefetch.js'
import { preserveExistingPayloadFields } from '../utils/preserveExistingPayloadFields.js'
import { sleep } from '../utils/sleep.js'

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    return null
  }

  const seconds = Math.round(ms / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${rest}s`
  }

  return `${rest}s`
}

/** Ventana para re-chequear fechas con marca legacy `'1'` sin presentationId. */
export const CNV_REPUBLISH_LOOKBACK_DAYS = 21

export function isRecentCnvReception(
  receptionAt,
  { now = Date.now(), withinDays = CNV_REPUBLISH_LOOKBACK_DAYS } = {},
) {
  if (!receptionAt) {
    return false
  }

  const time = Date.parse(receptionAt)
  if (!Number.isFinite(time)) {
    return false
  }

  return now - time <= withinDays * 24 * 60 * 60 * 1000
}

export class FundDetailsSyncService {
  constructor(repository, options = {}) {
    this.repository = repository
    this.pollIntervalMs = options.pollIntervalMs ?? getPollIntervalMs()
    this.r2UploadIntervalMs =
      options.r2UploadIntervalMs ?? getR2UploadIntervalMs()
    this.excelCacheDir =
      options.excelCacheDir ?? getCnvExcelCacheDir(repository.databasePath)
    this.downloadConcurrency = Math.min(
      32,
      Math.max(
        1,
        Math.floor(
          options.downloadConcurrency ?? getFreshDownloadConcurrency(),
        ),
      ),
    )
  }

  resolveClassIdMap(classIdToFondoId) {
    if (classIdToFondoId) {
      return classIdToFondoId
    }

    return mergeClassIdMaps(
      loadStaticClassIdToFondoIdMap(),
      this.repository.buildClassIdToFondoIdMap(),
    )
  }

  buildCurrentBySlugMap(currentByClassId) {
    const map = new Map()
    const funds = currentByClassId
      ? [...currentByClassId.values()]
      : this.repository.getCurrentFunds().map(fund => ({
          fondoId: fund.fondoId,
          claseId: fund.claseId,
          slug: fund.slug,
          nombre: fund.nombre,
          payload: fund,
        }))

    for (const fund of funds) {
      if (fund.slug) {
        map.set(fund.slug, fund)
      }
    }

    return map
  }

  seedBackfillContext(classIdToFondoId) {
    const currentByClassId = new Map()
    const currentBySlug = new Map()

    for (const fund of this.repository.getCurrentFunds()) {
      const record = {
        fondoId: fund.fondoId,
        claseId: fund.claseId,
        slug: fund.slug,
        nombre: fund.nombre,
        payload: fund,
      }
      currentByClassId.set(String(fund.claseId), record)
      if (fund.slug) {
        currentBySlug.set(fund.slug, record)
      }
    }

    return {
      classIdToFondoId,
      currentByClassId,
      currentBySlug,
      previousBySlug: this.repository.mapLatestSnapshotsBySlug(),
      firstBySlug: this.repository.mapFirstSnapshotsBySlug(),
    }
  }

  async fetchDocumentExcel(document) {
    return fetchCnvDocumentExcelCached(document, {
      cacheDir: this.excelCacheDir,
    })
  }

  persistParsedCnvDay(document, parsed, options = {}) {
    const upserted = this.repository.runInTransaction(() =>
      this.persistParsedCnvDaySync(document, parsed, options),
    )

    return {
      documentDate: document.documentDate,
      presentationId: document.presentationId,
      fileName: options.fileName ?? null,
      fromCache: options.fromCache === true,
      parsedFunds: parsed.funds.length,
      upserted,
    }
  }

  persistParsedCnvDaySync(document, parsed, options = {}) {
    const fondoIdMap = this.resolveClassIdMap(options.classIdToFondoId)
    const currentByClassId = options.currentByClassId ?? null
    const currentBySlug =
      options.currentBySlug ?? this.buildCurrentBySlugMap(currentByClassId)
    const previousBySlug = options.previousBySlug ?? null
    const firstBySlug = options.firstBySlug ?? null
    const skipRollingHistory = options.skipRollingHistory === true
    const persistFuenteOriginal = options.persistFuenteOriginal !== false
    let upserted = 0
    let failed = 0

    for (const row of parsed.funds) {
      try {
        const classKey = String(row.claseId)
        const existing = currentByClassId
          ? (currentByClassId.get(classKey) ?? null)
          : this.repository.getCurrentFundByClassId(row.claseId)
        const fondoId = existing?.fondoId || fondoIdMap.get(classKey) || null

        const provisional = mapCnvRowToPayload(row, { fondoId })
        const slugForHistory = existing?.slug || provisional.slug

        let history = []
        if (!skipRollingHistory) {
          history = this.repository
            .listHistoricalSnapshotsBySlug(slugForHistory)
            .filter(item => !row.fecha || item.fecha < row.fecha)
            .map(item => ({
              fecha: item.fecha,
              valorCuotaparte: item.valorCuotaparte,
            }))
        }

        const payload = preserveExistingPayloadFields(
          existing?.payload,
          mapCnvRowToPayload(row, {
            fondoId,
            history,
          }),
        )

        if (existing?.fondoId) {
          payload.fondoId = existing.fondoId
        }

        const nameSlug = payload.slug
        const existingSlug = existing?.slug || null
        const nameSlugOwner = nameSlug ? currentBySlug.get(nameSlug) : null
        const nameSlugTakenByOther = Boolean(
          nameSlugOwner &&
          String(nameSlugOwner.claseId) !== String(payload.claseId),
        )

        if (existingSlug && nameSlugTakenByOther) {
          payload.slug = existingSlug
        }

        payload.slug = allocateUniqueFundSlug(payload.slug, {
          claseId: payload.claseId,
          isTaken: slug => {
            const owner = currentBySlug.get(slug)
            return Boolean(
              owner && String(owner.claseId) !== String(payload.claseId),
            )
          },
        })

        if (existingSlug && payload.slug !== existingSlug) {
          this.repository.renameFundSlug(existingSlug, payload.slug)
          currentBySlug.delete(existingSlug)
          if (firstBySlug?.has(existingSlug)) {
            firstBySlug.set(payload.slug, firstBySlug.get(existingSlug))
            firstBySlug.delete(existingSlug)
          }
          if (previousBySlug?.has(existingSlug)) {
            previousBySlug.set(payload.slug, previousBySlug.get(existingSlug))
            previousBySlug.delete(existingSlug)
          }
          console.warn('[cafci-worker] slug actualizado por rename del fondo', {
            documentDate: document.documentDate,
            claseId: payload.claseId,
            nombre: payload.nombre,
            from: existingSlug,
            to: payload.slug,
          })
        } else if (payload.slug !== nameSlug && payload.slug !== existingSlug) {
          console.warn('[cafci-worker] slug duplicado, usando sufijo', {
            documentDate: document.documentDate,
            claseId: payload.claseId,
            nombre: payload.nombre,
            slug: payload.slug,
          })
        }

        payload.origen = 'cnv-excel'

        this.repository.upsertCurrentFundDetail(payload)

        const snapshot = recordHistoricalSnapshotFromDetailSync(
          this.repository,
          payload,
          {
            firstSnapshot: firstBySlug
              ? (firstBySlug.get(payload.slug) ?? null)
              : undefined,
            previousSnapshot: previousBySlug
              ? (previousBySlug.get(payload.slug) ?? null)
              : undefined,
            persistFuenteOriginal,
          },
        )

        const record = {
          fondoId: payload.fondoId,
          claseId: payload.claseId,
          slug: payload.slug,
          nombre: payload.nombre,
          payload,
        }

        if (snapshot && firstBySlug && !firstBySlug.has(payload.slug)) {
          firstBySlug.set(payload.slug, snapshot)
        }
        if (snapshot && previousBySlug) {
          previousBySlug.set(payload.slug, snapshot)
        }
        if (currentByClassId) {
          currentByClassId.set(classKey, record)
        }
        currentBySlug.set(payload.slug, record)

        fondoIdMap.set(String(payload.claseId), String(payload.fondoId))
        upserted += 1
      } catch (error) {
        failed += 1
        const message = error instanceof Error ? error.message : String(error)
        console.error('[cafci-worker] CNV fund persist failed', {
          documentDate: document.documentDate,
          claseId: row.claseId,
          nombre: row.nombre,
          message,
        })
      }
    }

    if (failed === 0 && document.documentDate) {
      this.repository.markCnvDateIngested(document.documentDate, document)
    }

    return upserted
  }

  async ingestCnvDocument(document, options = {}) {
    const downloaded =
      options.downloaded ?? (await this.fetchDocumentExcel(document))
    const parsed =
      options.parsed ??
      parseCnvCuotaparteExcel(downloaded.buffer, {
        documentDate: document.documentDate,
      })

    return this.persistParsedCnvDay(document, parsed, {
      ...options,
      fileName: downloaded.fileName,
      fromCache: downloaded.fromCache === true,
    })
  }

  /**
   * Días a ingerir en un ciclo: el pedido/último, más republicaciones
   * (misma fecha, otra presentationId) detectadas en el catálogo.
   */
  selectDocumentsForCycle(documents, { documentDate = null, now = Date.now() } = {}) {
    const chronological = listChronologicalCnvDocuments(documents)
    const primary = documentDate
      ? pickLatestDocumentForDate(documents, documentDate)
      : chronological.at(-1) ?? null

    if (!primary) {
      return []
    }

    const selected = new Map()
    selected.set(primary.documentDate, primary)

    for (const document of chronological) {
      if (document.documentDate === primary.documentDate) {
        continue
      }

      const meta = this.repository.getCnvIngestedMeta(document.documentDate)
      if (!meta) {
        // Crawl no backfillea fechas nunca vistas.
        continue
      }

      if (meta.presentationId) {
        if (meta.presentationId !== document.presentationId) {
          selected.set(document.documentDate, document)
        }
        continue
      }

      // Marca legacy `'1'`: re-chequear si la recepción es reciente
      // (correcciones tardías que aparecen ahora en el listado CNV).
      if (
        meta.legacy &&
        isRecentCnvReception(document.receptionAt, { now })
      ) {
        selected.set(document.documentDate, document)
      }
    }

    return [...selected.values()].sort((a, b) =>
      a.documentDate.localeCompare(b.documentDate),
    )
  }

  async runCycle({ documentDate = null } = {}) {
    const documents = await fetchCnvCuotaparteDocuments()
    const toIngest = this.selectDocumentsForCycle(documents, { documentDate })

    if (toIngest.length === 0) {
      return {
        source: 'cnv',
        documentDate: documentDate || null,
        upserted: 0,
        parsedFunds: 0,
        currentFunds: this.repository.getCurrentFunds().length,
        republished: 0,
        error: documentDate
          ? `No hay planilla CNV para ${documentDate}`
          : 'No hay planillas CNV disponibles',
      }
    }

    const results = []
    for (const document of toIngest) {
      results.push(await this.ingestCnvDocument(document))
    }

    const primary = toIngest[toIngest.length - 1]
    const republished = toIngest.filter(
      document => document.documentDate !== primary.documentDate,
    )

    if (republished.length > 0) {
      console.log('[cafci-worker] CNV republicaciones re-ingeridas', {
        count: republished.length,
        dates: republished.map(document => document.documentDate),
      })
    }

    let composicion = null
    if (isComposicionEnrichEnabled()) {
      try {
        composicion = await enrichComposicionCarteraFromCnv(this.repository, {
          limit: getComposicionEnrichLimit(),
        })
        console.log('[cafci-worker] composición CNV', composicion)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[cafci-worker] composición CNV falló', message)
        composicion = { error: message }
      }
    } else {
      composicion = { skipped: true, reason: 'disabled' }
    }

    const upserted = results.reduce((sum, item) => sum + (item.upserted || 0), 0)
    const parsedFunds = results.reduce(
      (sum, item) => sum + (item.parsedFunds || 0),
      0,
    )

    return {
      source: 'cnv',
      documentDate: primary.documentDate,
      presentationId: primary.presentationId,
      upserted,
      parsedFunds,
      daysIngested: results.length,
      republished: republished.length,
      results,
      composicion,
      currentFunds: this.repository.getCurrentFunds().length,
    }
  }

  async backfill({
    fromDate,
    toDate,
    documents = null,
    delayMs = 0,
    concurrency = this.downloadConcurrency,
    skipExisting = true,
    skipRollingHistory = true,
    persistFuenteOriginal = false,
  } = {}) {
    if (!fromDate || !toDate) {
      throw new Error('backfill requiere fromDate y toDate (YYYY-MM-DD)')
    }

    const catalog = documents ?? (await fetchCnvCuotaparteDocuments())
    const chronological = listChronologicalCnvDocuments(catalog, {
      fromDate,
      toDate,
    })
    const alreadyIngested = skipExisting
      ? chronological.filter(document =>
          this.repository.isCnvDocumentIngested(document),
        )
      : []
    const queue = skipExisting
      ? chronological.filter(
          document => !this.repository.isCnvDocumentIngested(document),
        )
      : chronological
    const classIdToFondoId = this.resolveClassIdMap()
    const context = this.seedBackfillContext(classIdToFondoId)
    const downloadConcurrency = Math.min(
      32,
      Math.max(1, Math.floor(concurrency)),
    )
    const pipeline = createOrderedPrefetch(
      queue.length,
      downloadConcurrency,
      index => this.fetchDocumentExcel(queue[index]),
    )
    const startedAt = Date.now()
    const results = alreadyIngested.map(document => ({
      documentDate: document.documentDate,
      skipped: true,
      reason: 'already-ingested',
    }))

    console.log('[cafci-worker] CNV backfill starting', {
      fromDate,
      toDate,
      total: chronological.length,
      queued: queue.length,
      skippedExisting: alreadyIngested.length,
      concurrency: downloadConcurrency,
    })

    for (const [index, document] of queue.entries()) {
      try {
        const downloaded = await pipeline.take(index)
        const result = await this.ingestCnvDocument(document, {
          downloaded,
          classIdToFondoId: context.classIdToFondoId,
          currentByClassId: context.currentByClassId,
          currentBySlug: context.currentBySlug,
          previousBySlug: context.previousBySlug,
          firstBySlug: context.firstBySlug,
          skipRollingHistory,
          persistFuenteOriginal,
        })
        results.push({ ...result, skipped: false })

        const processed = index + 1
        const elapsedMs = Date.now() - startedAt
        const etaMs =
          processed > 0
            ? (elapsedMs / processed) * (queue.length - processed)
            : null

        console.log('[cafci-worker] CNV backfill day', {
          index: processed,
          queued: queue.length,
          skippedExisting: alreadyIngested.length,
          documentDate: result.documentDate,
          upserted: result.upserted,
          fromCache: result.fromCache,
          elapsed: formatDuration(elapsedMs),
          eta: formatDuration(etaMs),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({
          documentDate: document.documentDate,
          skipped: true,
          reason: message,
        })
        console.error(
          '[cafci-worker] CNV backfill failed',
          document.documentDate,
          message,
        )
      }

      if (delayMs > 0 && index < queue.length - 1) {
        await sleep(delayMs)
      }
    }

    return {
      fromDate,
      toDate,
      days: results.length,
      ingested: results.filter(item => !item.skipped).length,
      skippedExisting: alreadyIngested.length,
      results,
      currentFunds: this.repository.getCurrentFunds().length,
    }
  }

  async fresh({
    fromDate = null,
    toDate = null,
    documents = null,
    delayMs = 0,
    concurrency = this.downloadConcurrency,
    skipExisting = true,
  } = {}) {
    const catalog = documents ?? (await fetchCnvCuotaparteDocuments())
    const chronological = listChronologicalCnvDocuments(catalog)
    const dates = chronological.map(document => document.documentDate)

    if (dates.length === 0) {
      return {
        fromDate: fromDate || null,
        toDate: toDate || null,
        days: 0,
        ingested: 0,
        skippedExisting: 0,
        results: [],
        currentFunds: this.repository.getCurrentFunds().length,
        error: 'No hay planillas CNV disponibles',
      }
    }

    return this.backfill({
      fromDate: fromDate || dates[0],
      toDate: toDate || dates[dates.length - 1],
      documents: catalog,
      delayMs,
      concurrency,
      skipExisting,
    })
  }

  shouldUploadBackup(now = Date.now()) {
    const lastUploadAt = this.repository.getWorkerState('last_r2_backup_at')

    if (!lastUploadAt) {
      return true
    }

    const lastUploadTime = new Date(lastUploadAt).getTime()

    if (!Number.isFinite(lastUploadTime)) {
      return true
    }

    return now - lastUploadTime >= this.r2UploadIntervalMs
  }

  async maybeUploadBackup() {
    if (!this.shouldUploadBackup()) {
      console.log('[cafci-worker] skipping R2 upload for this cycle', {
        nextEligibleInMs: this.r2UploadIntervalMs,
      })
      return false
    }

    const uploaded = await uploadDatabaseBackupToR2(this.repository)

    if (uploaded) {
      this.repository.setWorkerState(
        'last_r2_backup_at',
        new Date().toISOString(),
      )
    }

    return uploaded
  }

  async startPolling() {
    while (true) {
      try {
        const summary = await this.runCycle()
        await this.maybeUploadBackup()
        console.log('[cafci-worker] cycle summary', summary)
      } catch (error) {
        console.error('[cafci-worker] cycle failed', error)
      }

      await sleep(this.pollIntervalMs)
    }
  }
}
