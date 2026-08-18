import Database from 'better-sqlite3'
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearBaseDeDatosTemporal } from '../../../../helpers/sqlite.js'

vi.mock('@/finanzas/fci/fondos/preservarComposicionCartera.js', () => ({
  recuperarYLocalizarCamposFondo: async () => ({
    recuperados: 0,
    logosLocalizados: 0,
    headSources: 0,
  }),
}))

import fondosComando from '@/finanzas/fci/fondos/fondos.comando.js'
import { guardarDetalleFondo } from '@/finanzas/fci/fondos/guardado/guardarDetallesFondos.js'
import { leerRuta } from '@/utils/rutas.js'

const baseRuta = 'datos/v1/finanzas/fci/fondos'
const generatedSlugs = [
  'mercado-fondo-clase-a',
  'slug-publico-actual-clase-a',
  'alias-interno-congelado-clase-a',
]
const pathsToRestore = [
  'datos/v1/finanzas/fci/fondos/index.json',
  'datos/v1/finanzas/fci/comparatasas/index.json',
  'datos/v1/finanzas/fci/mercadoDinero/ultimo/index.json',
  'datos/v1/finanzas/fci/mercadoDinero/penultimo/index.json',
  'datos/v1/finanzas/fci/mercadoDinero/2026/05/21/index.json',
  'datos/v1/finanzas/fci/mercado/historico/index.json',
  ...generatedSlugs.flatMap(slug => [
    `${baseRuta}/${slug}/index.json`,
    `${baseRuta}/${slug}/historico/index.json`,
  ]),
]
let restoreDbPath
let pathBackups = {}

function backupGeneratedPaths() {
  pathBackups = {}
  for (const path of pathsToRestore) {
    pathBackups[path] = existsSync(path) ? readFileSync(path, 'utf8') : null
  }
}

function restoreGeneratedPaths() {
  for (const [path, content] of Object.entries(pathBackups)) {
    if (content == null) {
      rmSync(path, { force: true })
      continue
    }

    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  pathBackups = {}
}

function limpiarArchivos() {
  restoreGeneratedPaths()
}

afterEach(() => {
  limpiarArchivos()

  if (restoreDbPath) {
    restoreDbPath()
    restoreDbPath = undefined
  }
})

describe('guardarDetalleFondo', () => {
  it('escribe el slug público y el alias interno congelado', () => {
    backupGeneratedPaths()

    const fondo = {
      slug: 'alias-interno-congelado-clase-a',
      nombre: 'Slug Publico Actual - Clase A',
      fondoId: '1148',
      claseId: '3377',
    }

    expect(guardarDetalleFondo(fondo)).toBe('slug-publico-actual-clase-a')
    expect(existsSync(`${baseRuta}/slug-publico-actual-clase-a/index.json`)).toBe(
      true,
    )
    expect(
      existsSync(`${baseRuta}/alias-interno-congelado-clase-a/index.json`),
    ).toBe(true)
    expect(leerRuta('/finanzas/fci/fondos/slug-publico-actual-clase-a')).toEqual(
      leerRuta('/finanzas/fci/fondos/alias-interno-congelado-clase-a'),
    )
    expect(
      leerRuta('/finanzas/fci/fondos/slug-publico-actual-clase-a'),
    ).toMatchObject({
      fondoId: '1148',
      claseId: '3377',
      nombre: 'Slug Publico Actual - Clase A',
    })
  })
})

describe('fondosComando', () => {
  it('genera endpoints a partir de la sqlite del worker', async () => {
    backupGeneratedPaths()
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
        fondoId: '798',
        claseId: '1982',
        slug: 'mercado-fondo-clase-a',
        nombre: 'Mercado Fondo - Clase A',
        fecha: '2026-05-21',
        administradora: 'Administradora SA',
        depositaria: 'Depositaria SA',
        tipoRenta: 'Mercado de Dinero',
        horizonte: 'Corto Plazo',
        patrimonio: 1025,
        cantidadCuotapartes: 10.1485,
        rendimientos: {
          valorCuotaparte: 101,
          ultimos7Dias: 17.88,
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
        },
        sociedades: [
          {
            tipo: 'Administradora',
            nombre: 'Administradora SA',
            logo: 'https://example.com/logo.png',
          },
        ],
      }),
      '2026-05-21',
      '2026-05-21T10:00:00.000Z',
      '2026-05-21 10:00:00',
    )

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
          tipoRenta: 'Mercado de Dinero',
          tipoDD: null,
          region: null,
          benchmark: null,
          horizonte: 'Corto Plazo',
          duracion: null,
          moneda: null,
          codigoCNV: null,
          patrimonio: 1025,
          cantidadCuotapartes: 10.1485,
          inversionMinima: null,
          monedaInversion: null,
          plazoLiquidacionDias: null,
          rendimientos: {
            valorCuotaparte: 101,
            variacionDiariaPct: null,
            ultimos7Dias: null,
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

    expect(leerRuta('/finanzas/fci/mercadoDinero/ultimo')).toEqual([
      {
        fondo: 'Mercado Fondo - Clase A',
        horizonte: 'corto',
        fecha: '2026-05-21',
        vcp: 101,
        ccp: 10.1485,
        patrimonio: 1025,
      },
    ])

    expect(leerRuta('/finanzas/fci/mercadoDinero/penultimo')).toEqual([
      {
        fondo: 'Mercado Fondo - Clase A',
        horizonte: 'corto',
        fecha: '2026-05-20',
        vcp: 100,
        ccp: 10,
        patrimonio: 1000,
      },
    ])

    expect(leerRuta('/finanzas/fci/mercadoDinero/2026/05/21')).toEqual([
      {
        fondo: 'Mercado Fondo - Clase A',
        horizonte: 'corto',
        fecha: '2026-05-21',
        vcp: 101,
        ccp: 10.1485,
        patrimonio: 1025,
      },
    ])

    expect(
      leerRuta('/finanzas/fci/fondos/mercado-fondo-clase-a/historico'),
    ).toEqual({
      fondoId: '798',
      claseId: '1982',
      nombre: 'Mercado Fondo - Clase A',
      fechaActualizacion: '2026-05-21T10:00:00.000Z',
      historico: [
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
      ],
    })
  })
})
