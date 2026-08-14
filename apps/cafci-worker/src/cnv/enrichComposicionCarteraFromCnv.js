import {
  fetchCnvDetallesFciHtml,
  fetchCnvFciCatalog,
} from './cnvClient.js'
import { matchDetallesFciId } from './normalizeFciName.js'
import { parseDetallesFciHtml } from './parseDetallesFciHtml.js'
import { sleep } from '../utils/sleep.js'

const DEFAULT_COMPOSITION_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000
const DEFAULT_CONCURRENCY = 4
const DEFAULT_DELAY_MS = 150

function uniqueFundsByFondoId(funds) {
  const byFondoId = new Map()

  for (const fund of funds) {
    const fondoId = fund?.fondoId != null ? String(fund.fondoId) : null
    if (!fondoId) {
      continue
    }

    if (!byFondoId.has(fondoId)) {
      byFondoId.set(fondoId, fund)
    }
  }

  return [...byFondoId.values()]
}

function needsCompositionRefresh(payload, { now, maxAgeMs }) {
  const composition = payload?.composicionCartera
  if (!Array.isArray(composition) || composition.length === 0) {
    return true
  }

  const updatedAt = payload?.composicionActualizadaAt
  if (!updatedAt) {
    // Composición heredada (p. ej. CAFCI): refrescar una vez desde CNV.
    return true
  }

  const updatedTime = Date.parse(updatedAt)
  if (!Number.isFinite(updatedTime)) {
    return true
  }

  return now - updatedTime >= maxAgeMs
}

function prioritizeCompositionTargets(funds, { now, maxAgeMs }) {
  return [...funds].sort((a, b) => {
    const aEmpty = !a.composicionCartera?.length
    const bEmpty = !b.composicionCartera?.length
    if (aEmpty !== bEmpty) {
      return aEmpty ? -1 : 1
    }

    const aTime = Date.parse(a.composicionActualizadaAt || '') || 0
    const bTime = Date.parse(b.composicionActualizadaAt || '') || 0
    return aTime - bTime
  }).filter(fund => needsCompositionRefresh(fund, { now, maxAgeMs }))
}

function applyCompositionToPayload(payload, detalle, { detallesFciId, nowIso }) {
  const next = { ...payload }

  if (detalle.composicionCartera.length > 0) {
    next.composicionCartera = detalle.composicionCartera
    next.composicionActualizadaAt = nowIso
    if (detalle.fecha) {
      next.fechaComposicionCartera = detalle.fecha
    }
  }

  if (detallesFciId) {
    next.detallesFciId = String(detallesFciId)
  }

  for (const [fromKey, toKey] of [
    ['horizonte', 'horizonte'],
    ['region', 'region'],
    ['tipoRenta', 'tipoRenta'],
  ]) {
    const value = detalle[fromKey]
    if (value && (!next[toKey] || next[toKey] === '' || next[toKey] === 'No Registrado')) {
      next[toKey] = value
    }
  }

  return next
}

/**
 * Enriquece current_fund_details con la última composición de cartera CNV
 * (DetallesFCI). Un fetch por fondoId; se aplica a todas las clases del fondo.
 */
export async function enrichComposicionCarteraFromCnv(repository, options = {}) {
  const {
    catalog = null,
    fetchCatalog = fetchCnvFciCatalog,
    fetchDetalleHtml = fetchCnvDetallesFciHtml,
    parseHtml = parseDetallesFciHtml,
    concurrency = DEFAULT_CONCURRENCY,
    delayMs = DEFAULT_DELAY_MS,
    maxAgeMs = DEFAULT_COMPOSITION_MAX_AGE_MS,
    now = Date.now(),
    limit = null,
  } = options

  const funds = repository.getCurrentFunds()
  const uniqueFunds = uniqueFundsByFondoId(funds)
  const cnvCatalog = catalog || (await fetchCatalog())

  const targets = prioritizeCompositionTargets(uniqueFunds, { now, maxAgeMs })

  const limited =
    typeof limit === 'number' && limit > 0 ? targets.slice(0, limit) : targets

  const nowIso = new Date(now).toISOString()
  const stats = {
    catalogSize: cnvCatalog.length,
    uniqueFunds: uniqueFunds.length,
    candidates: limited.length,
    matched: 0,
    updated: 0,
    skippedUnmatched: 0,
    failed: 0,
    classesUpdated: 0,
  }

  const queue = [...limited]
  const workers = Array.from(
    { length: Math.max(1, concurrency) },
    async () => {
      while (queue.length > 0) {
        const fund = queue.shift()
        if (!fund) {
          break
        }

        const match =
          fund.detallesFciId != null && String(fund.detallesFciId)
            ? {
                id: String(fund.detallesFciId),
                text: fund.nombre,
                score: 1,
              }
            : matchDetallesFciId(fund.nombre, cnvCatalog)
        if (!match) {
          stats.skippedUnmatched += 1
          continue
        }

        stats.matched += 1

        try {
          const html = await fetchDetalleHtml(match.id)
          const detalle = parseHtml(html)

          if (detalle.composicionCartera.length === 0) {
            continue
          }

          const classes = funds.filter(
            item => String(item.fondoId) === String(fund.fondoId),
          )

          for (const classPayload of classes) {
            const enriched = applyCompositionToPayload(classPayload, detalle, {
              detallesFciId: match.id,
              nowIso,
            })
            repository.upsertCurrentFundDetail(enriched)
            stats.classesUpdated += 1
          }

          stats.updated += 1
        } catch (error) {
          stats.failed += 1
          const message =
            error instanceof Error ? error.message : String(error)
          console.error(
            '[cafci-worker] composición CNV falló',
            fund.nombre,
            match.id,
            message,
          )
        }

        if (delayMs > 0) {
          await sleep(delayMs)
        }
      }
    },
  )

  await Promise.all(workers)

  return stats
}
