import Database from 'better-sqlite3'
import { existsSync, rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { crearBaseDeDatosTemporal } from '../../../../helpers/sqlite.js'
import fondosComando from '@/finanzas/fci/fondos/fondos.comando.js'
import { leerRuta } from '@/utils/rutas.js'

const baseRuta = 'datos/v1/finanzas/fci/fondos'
let restoreDbPath

function limpiarArchivos() {
  rmSync(baseRuta, {
    recursive: true,
    force: true,
  })
}

afterEach(() => {
  limpiarArchivos()

  if (restoreDbPath) {
    restoreDbPath()
    restoreDbPath = undefined
  }
})

describe('fondosComando', () => {
  it('genera endpoints a partir de la sqlite del worker', async () => {
    const temporal = crearBaseDeDatosTemporal('fci-fondos-command')
    const dbPath = temporal.url.replace(/^file:/, '')
    const db = new Database(dbPath)
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
        fundId: '798',
        classId: '1982',
        slug: 'mercado-fondo-clase-a',
        name: 'Mercado Fondo - Clase A',
        date: '2026-05-21',
        manager: 'Administradora SA',
        depositary: 'Depositaria SA',
        performance: {
          shareValue: 24088.316,
          last7Days: 17.88,
        },
        portfolioComposition: [
          {
            name: 'Plazo Fijo',
            percentage: 80,
          },
        ],
        ratings: [
          {
            agency: 'Fix',
            rating: 'AA',
            date: '2026-05-20',
          },
        ],
        fees: {
          managerFee: 1,
        },
        societies: [
          {
            type: 'Administradora',
            name: 'Administradora SA',
            logoUrl: 'https://example.com/logo.png',
          },
        ],
      }),
      '2026-05-21',
      '2026-05-21T10:00:00.000Z',
      '2026-05-21 10:00:00',
    )
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
      '2026-05-20',
      'mercadoDinero',
      'Mercado de Dinero',
      'corto',
      100,
      1000,
      null,
      0,
      null,
      'legacy-json',
      JSON.stringify({ fuente: 'test' }),
    )
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
      '2026-05-21',
      'mercadoDinero',
      'Mercado de Dinero',
      'corto',
      101,
      1025,
      1,
      1,
      15,
      'cafci-detail',
      JSON.stringify({ fuente: 'test' }),
    )
    db.close()

    const previous = process.env.VITE_CAFCI_WORKER_DB_PATH
    process.env.VITE_CAFCI_WORKER_DB_PATH = dbPath
    restoreDbPath = () => {
      if (previous === undefined) {
        delete process.env.VITE_CAFCI_WORKER_DB_PATH
      } else {
        process.env.VITE_CAFCI_WORKER_DB_PATH = previous
      }
      temporal.cleanup()
    }

    const resultado = await fondosComando()

    expect(resultado).toBe(true)
    expect(existsSync(`${baseRuta}/index.json`)).toBe(true)
    expect(existsSync(`${baseRuta}/mercado-fondo-clase-a/index.json`)).toBe(
      true,
    )
    expect(
      existsSync(`${baseRuta}/mercado-fondo-clase-a/historico/index.json`),
    ).toBe(true)

    expect(leerRuta('/finanzas/fci/fondos')).toEqual({
      fechaActualizacion: '2026-05-21T10:00:00.000Z',
      fondos: [
        {
          fondoId: '798',
          claseId: '1982',
          nombre: 'Mercado Fondo - Clase A',
          fecha: '2026-05-21',
          administradora: 'Administradora SA',
          depositaria: 'Depositaria SA',
          tipoRenta: null,
          tipoDD: null,
          region: null,
          benchmark: null,
          horizonte: null,
          duration: null,
          moneda: null,
          codigoCNV: null,
          patrimonio: null,
          inversionMinima: null,
          monedaInversion: null,
          plazoLiquidacionDias: null,
          rendimientos: {
            valorCuotaparte: 24088.316,
            ultimos7Dias: 17.88,
            unMes: null,
            noventaDias: null,
            cientoOchentaDias: null,
            enElAnio: null,
            doceMeses: null,
          },
          composicionCartera: [
            {
              nombre: 'Plazo Fijo',
              porcentaje: 80,
            },
          ],
          calificaciones: [
            {
              calificadora: 'Fix',
              calificacion: 'AA',
              fecha: '2026-05-20',
            },
          ],
          honorarios: {
            honorarioGerente: 1,
            honorarioDepositaria: null,
            comisionIngreso: null,
            comisionEgreso: null,
            comisionTransferencia: null,
            gastosOrdinariosGestion: null,
            comisionExito: null,
            otros: null,
          },
          sociedades: [
            {
              tipo: 'Administradora',
              nombre: 'Administradora SA',
              logo: 'https://example.com/logo.png',
            },
          ],
        },
      ],
    })
    expect(leerRuta('/finanzas/fci/fondos/mercado-fondo-clase-a/historico')).toEqual({
      fondoId: '798',
      claseId: '1982',
      nombre: 'Mercado Fondo - Clase A',
      fechaActualizacion: '2026-05-21T10:00:00.000Z',
      historico: [
        {
          slug: 'mercado-fondo-clase-a',
          fundId: '798',
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
          fundId: '798',
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
      ],
    })
  })
})
