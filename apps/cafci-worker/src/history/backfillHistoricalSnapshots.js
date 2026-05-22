import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { getLegacyHistoryRoot } from '../config.js'
import { buildFundSlug } from '../utils/buildFundSlug.js'
import { buildHistoricalSnapshot } from './buildHistoricalSnapshot.js'
import { historyCategoryLabels } from './historyCategories.js'

function isHistoricalDateIndex(rootDirectory, pathname) {
  const parts = relative(rootDirectory, pathname).split('/')

  return (
    parts.length === 4 &&
    /^\d{4}$/.test(parts[0]) &&
    /^\d{2}$/.test(parts[1]) &&
    /^\d{2}$/.test(parts[2]) &&
    parts[3] === 'index.json'
  )
}

function listDateIndexFiles(rootDirectory) {
  const pending = [rootDirectory]
  const files = []

  while (pending.length > 0) {
    const current = pending.pop()

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)

      if (entry.isDirectory()) {
        pending.push(fullPath)
        continue
      }

      if (entry.isFile() && isHistoricalDateIndex(rootDirectory, fullPath)) {
        files.push(fullPath)
      }
    }
  }

  return files.sort()
}

function readJson(pathname) {
  return JSON.parse(readFileSync(pathname, 'utf8'))
}

export async function backfillHistoricalSnapshots(
  repository,
  { legacyRoot = getLegacyHistoryRoot() } = {},
) {
  if (!existsSync(legacyRoot) || repository.isHistoricalBackfillCompleted()) {
    return 0
  }

  const legacyRowsBySlug = new Map()

  for (const [categoryKey, categoryLabel] of Object.entries(
    historyCategoryLabels,
  )) {
    const seriesRoot = join(legacyRoot, categoryKey)

    if (!existsSync(seriesRoot)) {
      continue
    }

    for (const indexPath of listDateIndexFiles(seriesRoot)) {
      const records = readJson(indexPath)

      for (const record of records) {
        if (!record.fecha) {
          continue
        }

        const slug = buildFundSlug({
          name: record.fondo,
          fundId: 'legacy',
          classId: categoryKey,
        })

        if (!legacyRowsBySlug.has(slug)) {
          legacyRowsBySlug.set(slug, [])
        }

        legacyRowsBySlug.get(slug).push({
          slug,
          fundId: null,
          classId: null,
          name: record.fondo,
          sourceDate: record.fecha,
          categoryKey,
          categoryLabel,
          horizon: record.horizonte ?? null,
          shareValue: typeof record.vcp === 'number' ? record.vcp : null,
          assetsUnderManagement:
            typeof record.patrimonio === 'number' && record.patrimonio > 0
              ? record.patrimonio
              : null,
          sourceKind: 'legacy-json',
          rawSource: record,
        })
      }
    }
  }

  let imported = 0

  for (const rows of legacyRowsBySlug.values()) {
    rows.sort((a, b) => a.sourceDate.localeCompare(b.sourceDate))

    let firstSnapshot = null
    let previousSnapshot = null

    for (const row of rows) {
      const snapshot = buildHistoricalSnapshot(row, {
        firstSnapshot,
        previousSnapshot,
      })

      repository.upsertHistoricalSnapshot(snapshot)
      imported += 1

      firstSnapshot ||= snapshot
      previousSnapshot = snapshot
    }
  }

  repository.markHistoricalBackfillCompleted()

  return imported
}
