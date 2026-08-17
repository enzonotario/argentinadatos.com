import {
  downloadCnvDocumentExcel,
  fetchCnvCuotaparteDocuments,
  listChronologicalCnvDocuments,
  pickLatestAvailableDocument,
  pickLatestDocumentForDate,
} from '../cnv/cnvClient.js'
import { enrichComposicionCarteraFromCnv } from '../cnv/enrichComposicionCarteraFromCnv.js'
import { mapCnvRowToPayload } from '../cnv/mapCnvRowToPayload.js'
import { parseCnvCuotaparteExcel } from '../cnv/parseCnvExcel.js'
import {
  loadStaticClassIdToFondoIdMap,
  mergeClassIdMaps,
} from '../cnv/staticFundIdMap.js'
import {
  getComposicionEnrichLimit,
  getPollIntervalMs,
  getR2UploadIntervalMs,
  isComposicionEnrichEnabled,
} from '../config.js'
import { recordHistoricalSnapshotFromDetail } from '../history/recordHistoricalSnapshotFromDetail.js'
import { uploadDatabaseBackupToR2 } from '../r2/uploadDatabaseBackupToR2.js'
import { preserveExistingPayloadFields } from '../utils/preserveExistingPayloadFields.js'
import { sleep } from '../utils/sleep.js'

export class FundDetailsSyncService {
  constructor(repository, options = {}) {
    this.repository = repository
    this.pollIntervalMs = options.pollIntervalMs ?? getPollIntervalMs()
    this.r2UploadIntervalMs =
      options.r2UploadIntervalMs ?? getR2UploadIntervalMs()
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

  async ingestCnvDocument(document, { classIdToFondoId } = {}) {
    const downloaded = await downloadCnvDocumentExcel(document)
    const parsed = parseCnvCuotaparteExcel(downloaded.buffer, {
      documentDate: document.documentDate,
    })

    const fondoIdMap = this.resolveClassIdMap(classIdToFondoId)
    let upserted = 0

    for (const row of parsed.funds) {
      const existing = this.repository.getCurrentFundByClassId(row.claseId)
      const fondoId =
        existing?.fondoId || fondoIdMap.get(String(row.claseId)) || null

      const provisional = mapCnvRowToPayload(row, { fondoId })
      const slugForHistory = existing?.slug || provisional.slug

      const history = this.repository
        .listHistoricalSnapshotsBySlug(slugForHistory)
        .filter(item => !row.fecha || item.fecha < row.fecha)
        .map(item => ({
          fecha: item.fecha,
          valorCuotaparte: item.valorCuotaparte,
        }))

      const payload = preserveExistingPayloadFields(
        existing?.payload,
        mapCnvRowToPayload(row, {
          fondoId,
          history,
        }),
      )

      if (existing?.slug) {
        payload.slug = existing.slug
      }
      if (existing?.fondoId) {
        payload.fondoId = existing.fondoId
      }

      payload.origen = 'cnv-excel'

      this.repository.upsertCurrentFundDetail(payload)
      await recordHistoricalSnapshotFromDetail(this.repository, payload)
      fondoIdMap.set(String(payload.claseId), String(payload.fondoId))
      upserted += 1
    }

    return {
      documentDate: document.documentDate,
      presentationId: document.presentationId,
      fileName: downloaded.fileName,
      parsedFunds: parsed.funds.length,
      upserted,
    }
  }

  async runCycle({ documentDate = null } = {}) {
    const documents = await fetchCnvCuotaparteDocuments()
    const document = documentDate
      ? pickLatestDocumentForDate(documents, documentDate)
      : pickLatestAvailableDocument(documents)

    if (!document) {
      return {
        source: 'cnv',
        documentDate: documentDate || null,
        upserted: 0,
        parsedFunds: 0,
        currentFunds: this.repository.getCurrentFunds().length,
        error: documentDate
          ? `No hay planilla CNV para ${documentDate}`
          : 'No hay planillas CNV disponibles',
      }
    }

    const result = await this.ingestCnvDocument(document)

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

    return {
      source: 'cnv',
      ...result,
      composicion,
      currentFunds: this.repository.getCurrentFunds().length,
    }
  }

  async backfill({
    fromDate,
    toDate,
    documents = null,
    delayMs = 0,
  } = {}) {
    if (!fromDate || !toDate) {
      throw new Error('backfill requiere fromDate y toDate (YYYY-MM-DD)')
    }

    const catalog = documents ?? (await fetchCnvCuotaparteDocuments())
    const queue = listChronologicalCnvDocuments(catalog, { fromDate, toDate })
    const classIdToFondoId = this.resolveClassIdMap()
    const results = []

    for (const [index, document] of queue.entries()) {
      try {
        const result = await this.ingestCnvDocument(document, {
          classIdToFondoId,
        })
        results.push({ ...result, skipped: false })
        console.log('[cafci-worker] CNV backfill day', {
          index: index + 1,
          total: queue.length,
          documentDate: result.documentDate,
          upserted: result.upserted,
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
      results,
      currentFunds: this.repository.getCurrentFunds().length,
    }
  }

  async fresh({
    fromDate = null,
    toDate = null,
    documents = null,
    delayMs = 0,
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
