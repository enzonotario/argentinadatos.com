import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizarPayloadFondo } from '../../../../../apps/cafci-worker/src/utils/normalizarPayloadFondo.js'

function obtenerRutaDbFondos() {
  return resolve(
    process.env.VITE_CAFCI_WORKER_DB_PATH ||
      process.env.CAFCI_WORKER_DB_PATH ||
      process.env.VITE_FCI_FUND_DETAILS_DB_PATH ||
      process.env.FCI_FUND_DETAILS_DB_PATH ||
      'storage/cafci-worker/db.sqlite',
  )
}

function parsearJsonSeguro(texto) {
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

function normalizarFechaIso(texto) {
  if (!texto) {
    return new Date().toISOString()
  }

  if (/Z$|[+-]\d{2}:\d{2}$/.test(texto)) {
    return new Date(texto).toISOString()
  }

  return new Date(texto.replace(' ', 'T') + 'Z').toISOString()
}

export class FciFondosDatabaseService {
  constructor(dbPath = obtenerRutaDbFondos()) {
    this.dbPath = dbPath
  }

  obtenerSnapshotActual() {
    if (!existsSync(this.dbPath)) {
      return null
    }

    const db = new Database(this.dbPath, {
      readonly: true,
      fileMustExist: true,
    })

    try {
      if (this.tieneTabla(db, 'current_fund_details')) {
        return this.leerDesdeTablaActual(db)
      }

      if (this.tieneTabla(db, 'fund_detail_jobs')) {
        return this.leerDesdeJobs(
          db,
          'fund_detail_jobs',
          'payload',
          'execution_date',
          'status',
        )
      }

      if (this.tieneTabla(db, 'fci_detalles_jobs')) {
        return this.leerDesdeJobs(
          db,
          'fci_detalles_jobs',
          'datos',
          'fecha_ejecucion',
          'estado',
        )
      }

      return null
    } finally {
      db.close()
    }
  }

  obtenerHistorialPorSlug(slug) {
    if (!existsSync(this.dbPath)) {
      return []
    }

    const db = new Database(this.dbPath, {
      readonly: true,
      fileMustExist: true,
    })

    try {
      if (!this.tieneTabla(db, 'historical_fund_snapshots')) {
        return []
      }

      return db
        .prepare(
          `
            SELECT *
            FROM historical_fund_snapshots
            WHERE slug = ?
            ORDER BY source_date
          `,
        )
        .all(slug)
        .map(row => ({
          slug: row.slug,
          fondoId: row.fund_id,
          claseId: row.class_id,
          nombre: row.name,
          fecha: row.source_date,
          categoria: row.category_label,
          categoriaKey: row.category_key,
          horizonte: row.horizon,
          valorCuotaparte: row.share_value,
          patrimonio: row.assets_under_management,
          retornoDiario: row.daily_return,
          retornoAcumulado: row.cumulative_return,
          flujoEstimado: row.estimated_net_flow,
          origen: row.source_kind,
        }))
    } finally {
      db.close()
    }
  }

  tieneTabla(db, nombreTabla) {
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(nombreTabla)

    return Boolean(row)
  }

  leerDesdeTablaActual(db) {
    const rows = db
      .prepare(
        `
          SELECT payload
          FROM current_fund_details
          ORDER BY lower(name), lower(slug)
        `,
      )
      .all()

    const fondos = rows
      .map(row => parsearJsonSeguro(row.payload))
      .filter(Boolean)
      .map(payload => normalizarPayloadFondo(payload))

    if (fondos.length === 0) {
      return null
    }

    const updatedAt = db
      .prepare('SELECT MAX(updated_at) AS updatedAt FROM current_fund_details')
      .get()?.updatedAt

    return {
      fechaActualizacion: normalizarFechaIso(updatedAt),
      fondos,
    }
  }

  leerDesdeJobs(
    db,
    tableName,
    payloadColumn,
    executionDateColumn,
    statusColumn,
  ) {
    const latest = db
      .prepare(
        `
          SELECT MAX(${executionDateColumn}) AS executionDate
          FROM ${tableName}
          WHERE ${statusColumn} = 'completed'
        `,
      )
      .get()?.executionDate

    if (!latest) {
      return null
    }

    const rows = db
      .prepare(
        `
          SELECT ${payloadColumn} AS payload
          FROM ${tableName}
          WHERE ${executionDateColumn} = ?
            AND ${statusColumn} = 'completed'
          ORDER BY id
        `,
      )
      .all(latest)

    const fondos = rows
      .map(row => parsearJsonSeguro(row.payload))
      .filter(Boolean)
      .map(payload => normalizarPayloadFondo(payload))

    if (fondos.length === 0) {
      return null
    }

    return {
      fechaActualizacion: new Date(`${latest}T00:00:00.000Z`).toISOString(),
      fondos,
    }
  }
}
