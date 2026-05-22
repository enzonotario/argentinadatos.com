import { normalizarPayloadFondo } from '../../utils/normalizarPayloadFondo.js'

function parseJson(value) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeHistoricalSource(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source
  }

  if (
    'fondoId' in source ||
    'fundId' in source ||
    'name' in source ||
    'nombre' in source
  ) {
    return normalizarPayloadFondo(source)
  }

  return source
}

export default {
  id: '004NormalizeSpanishPayloads',
  run(database) {
    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'current_fund_details'",
        )
        .get()
    ) {
      const rows = database
        .prepare(
          'SELECT fund_id, class_id, slug, name, payload, source_date, fetched_at FROM current_fund_details',
        )
        .all()

      const update = database.prepare(`
        UPDATE current_fund_details
        SET name = ?,
            payload = ?,
            source_date = ?
        WHERE fund_id = ? AND class_id = ?
      `)

      for (const row of rows) {
        const payload = parseJson(row.payload)
        if (!payload) {
          continue
        }

        const normalized = normalizarPayloadFondo({
          ...payload,
          fondoId: payload.fondoId ?? payload.fundId ?? row.fund_id,
          claseId: payload.claseId ?? payload.classId ?? row.class_id,
          slug: payload.slug ?? row.slug,
          nombre: payload.nombre ?? payload.name ?? row.name,
          fecha: payload.fecha ?? payload.date ?? row.source_date ?? null,
        })

        update.run(
          normalized.nombre ?? row.name,
          JSON.stringify(normalized),
          normalized.fecha ?? row.source_date ?? null,
          row.fund_id,
          row.class_id,
        )
      }
    }

    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fund_detail_jobs'",
        )
        .get()
    ) {
      const rows = database
        .prepare(
          'SELECT id, fund_id, class_id, slug, name, execution_date, payload FROM fund_detail_jobs WHERE payload IS NOT NULL',
        )
        .all()

      const update = database.prepare(`
        UPDATE fund_detail_jobs
        SET name = ?, payload = ?
        WHERE id = ?
      `)

      for (const row of rows) {
        const payload = parseJson(row.payload)
        if (!payload) {
          continue
        }

        const normalized = normalizarPayloadFondo({
          ...payload,
          fondoId: payload.fondoId ?? payload.fundId ?? row.fund_id,
          claseId: payload.claseId ?? payload.classId ?? row.class_id,
          slug: payload.slug ?? row.slug,
          nombre: payload.nombre ?? payload.name ?? row.name,
          fecha: payload.fecha ?? payload.date ?? row.execution_date ?? null,
        })

        update.run(
          normalized.nombre ?? row.name,
          JSON.stringify(normalized),
          row.id,
        )
      }
    }

    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'historical_fund_snapshots'",
        )
        .get()
    ) {
      const rows = database
        .prepare(
          'SELECT id, fund_id, class_id, name, raw_source FROM historical_fund_snapshots WHERE raw_source IS NOT NULL',
        )
        .all()

      const update = database.prepare(`
        UPDATE historical_fund_snapshots
        SET raw_source = ?
        WHERE id = ?
      `)

      for (const row of rows) {
        const rawSource = parseJson(row.raw_source)
        if (!rawSource) {
          continue
        }

        const normalizedSource = normalizeHistoricalSource({
          ...rawSource,
          fondoId: rawSource.fondoId ?? rawSource.fundId ?? row.fund_id ?? null,
          claseId:
            rawSource.claseId ?? rawSource.classId ?? row.class_id ?? null,
          nombre: rawSource.nombre ?? rawSource.name ?? row.name,
        })

        update.run(JSON.stringify(normalizedSource), row.id)
      }
    }

    if (
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'worker_state'",
        )
        .get()
    ) {
      database
        .prepare(
          "DELETE FROM worker_state WHERE key = 'historical_backfill_completed_at'",
        )
        .run()
    }
  },
}
