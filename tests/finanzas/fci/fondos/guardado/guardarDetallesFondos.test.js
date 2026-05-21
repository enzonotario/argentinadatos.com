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
  })
})
