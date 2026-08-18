import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { crearBaseDeDatosTemporal } from '../../../../helpers/sqlite.js'
import { FciFondosDatabaseService } from '@/finanzas/fci/fondos/database/service.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

describe('FciFondosDatabaseService', () => {
  it('lee el snapshot actual desde current_fund_details', () => {
    const temporal = crearBaseDeDatosTemporal('fci-fondos-current')
    cleanups.push(temporal.cleanup)

    const db = new Database(temporal.url.replace(/^file:/, ''))
    db.exec(`
      CREATE TABLE current_fund_details (
        fund_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        payload TEXT NOT NULL,
        source_date TEXT,
        fetched_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (fund_id, class_id)
      )
    `)

    db.prepare(
      `
      INSERT INTO current_fund_details (
        fund_id,
        class_id,
        slug,
        name,
        payload,
        source_date,
        fetched_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      '798',
      '1982',
      'mercado-fondo-clase-a',
      'Mercado Fondo - Clase A',
      JSON.stringify({
        fondoId: '798',
        claseId: '1982',
        slug: 'mercado-fondo-clase-a',
        nombre: 'Mercado Fondo - Clase A',
        fecha: '2026-05-21',
        rendimientos: {
          valorCuotaparte: 24088.316,
        },
      }),
      '2026-05-21',
      '2026-05-21T10:00:00.000Z',
      '2026-05-21 10:00:00',
    )
    db.close()

    const service = new FciFondosDatabaseService(
      temporal.url.replace(/^file:/, ''),
    )
    const snapshot = service.obtenerSnapshotActual()

    expect(snapshot?.fondos).toHaveLength(1)
    expect(snapshot?.fondos[0]).toMatchObject({
      fondoId: '798',
      claseId: '1982',
      slug: 'mercado-fondo-clase-a',
      nombre: 'Mercado Fondo - Clase A',
    })
    expect(snapshot?.fechaActualizacion).toBe('2026-05-21T10:00:00.000Z')
  })

  it('hace fallback al schema legacy de jobs', () => {
    const temporal = crearBaseDeDatosTemporal('fci-fondos-legacy')
    cleanups.push(temporal.cleanup)

    const db = new Database(temporal.url.replace(/^file:/, ''))
    db.exec(`
      CREATE TABLE fci_detalles_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_ejecucion TEXT NOT NULL,
        estado TEXT NOT NULL,
        datos TEXT
      )
    `)

    db.prepare(
      `
      INSERT INTO fci_detalles_jobs (fecha_ejecucion, estado, datos)
      VALUES (?, ?, ?)
    `,
    ).run(
      '2026-05-20',
      'completed',
      JSON.stringify({
        fondoId: '100',
        claseId: '200',
        nombre: 'Fondo Legacy',
      }),
    )
    db.close()

    const service = new FciFondosDatabaseService(
      temporal.url.replace(/^file:/, ''),
    )
    const snapshot = service.obtenerSnapshotActual()

    expect(snapshot).toEqual({
      fechaActualizacion: '2026-05-20T00:00:00.000Z',
      fondos: [
        {
          fondoId: '100',
          claseId: '200',
          nombre: 'Fondo Legacy',
          slug: null,
          fecha: null,
          administradora: null,
          depositaria: null,
          tipoRenta: null,
          tipoDD: null,
          region: null,
          benchmark: null,
          horizonte: null,
          duracion: null,
          moneda: null,
          codigoCNV: null,
          patrimonio: null,
          cantidadCuotapartes: null,
          inversionMinima: null,
          monedaInversion: null,
          plazoLiquidacionDias: null,
          rendimientos: {
            valorCuotaparte: null,
            variacionDiariaPct: null,
            ultimos7Dias: null,
            unMes: null,
            noventaDias: null,
            cientoOchentaDias: null,
            enElAnio: null,
            doceMeses: null,
          },
          composicionCartera: [],
          calificaciones: [],
          honorarios: {
            honorarioGerente: null,
            honorarioDepositaria: null,
            comisionIngreso: null,
            comisionEgreso: null,
            comisionTransferencia: null,
            gastosOrdinariosGestion: null,
            comisionExito: null,
            otros: null,
          },
          sociedades: [],
        },
      ],
    })
  })

  it('lee el histórico por slug desde historical_fund_snapshots', () => {
    const temporal = crearBaseDeDatosTemporal('fci-fondos-history')
    cleanups.push(temporal.cleanup)

    const db = new Database(temporal.url.replace(/^file:/, ''))
    db.exec(`
      CREATE TABLE historical_fund_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        fund_id TEXT,
        class_id TEXT,
        name TEXT NOT NULL,
        source_date TEXT NOT NULL,
        category_key TEXT,
        category_label TEXT,
        horizon TEXT,
        share_value REAL,
        assets_under_management REAL,
        daily_return REAL,
        cumulative_return REAL,
        estimated_net_flow REAL,
        source_kind TEXT NOT NULL,
        raw_source TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (slug, source_date)
      )
    `)

    for (const row of [
      ['2026-05-20', 100, 1000, null, 0, null, 'legacy-json'],
      ['2026-05-21', 101, 1025, 1, 1, 15, 'cafci-detail'],
    ]) {
      db.prepare(
        `
        INSERT INTO historical_fund_snapshots (
          slug,
          fund_id,
          class_id,
          name,
          source_date,
          category_key,
          category_label,
          horizon,
          share_value,
          assets_under_management,
          daily_return,
          cumulative_return,
          estimated_net_flow,
          source_kind,
          raw_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        'mercado-fondo-clase-a',
        '798',
        '1982',
        'Mercado Fondo - Clase A',
        row[0],
        'mercadoDinero',
        'Mercado de Dinero',
        'corto',
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        row[6],
        JSON.stringify({ fuente: 'test' }),
      )
    }
    db.close()

    const service = new FciFondosDatabaseService(
      temporal.url.replace(/^file:/, ''),
    )
    const historial = service.obtenerHistorialPorSlug('mercado-fondo-clase-a')

    expect(historial).toEqual([
      {
        slug: 'mercado-fondo-clase-a',
        fondoId: '798',
        claseId: '1982',
        nombre: 'Mercado Fondo - Clase A',
        fecha: '2026-05-20',
        categoria: 'Mercado de Dinero',
        categoriaKey: 'mercadoDinero',
        horizonte: 'corto',
        valorCuotaparte: 100,
        patrimonio: 1000,
        retornoDiario: null,
        retornoAcumulado: 0,
        flujoEstimado: null,
        origen: 'legacy-json',
      },
      {
        slug: 'mercado-fondo-clase-a',
        fondoId: '798',
        claseId: '1982',
        nombre: 'Mercado Fondo - Clase A',
        fecha: '2026-05-21',
        categoria: 'Mercado de Dinero',
        categoriaKey: 'mercadoDinero',
        horizonte: 'corto',
        valorCuotaparte: 101,
        patrimonio: 1025,
        retornoDiario: 1,
        retornoAcumulado: 1,
        flujoEstimado: 15,
        origen: 'cafci-detail',
      },
    ])
  })
})
