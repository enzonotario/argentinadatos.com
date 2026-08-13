import Database from 'better-sqlite3'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  logoFileStemFromUrl,
  localizarLogosFondos,
  recuperarComposicionCartera,
  recuperarYLocalizarCamposFondo,
} from '@/finanzas/fci/fondos/preservarComposicionCartera.js'

const cleanups = []

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()()
  }
})

describe('recuperarComposicionCartera', () => {
  it('recupera composicionCartera desde el JSON exportado y la persiste en SQLite', () => {
    const directory = join(tmpdir(), `fci-composicion-${Date.now()}`)
    mkdirSync(directory, { recursive: true })
    cleanups.push(() => rmSync(directory, { recursive: true, force: true }))

    const dbPath = join(directory, 'db.sqlite')
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
        fund_id, class_id, slug, name, payload, source_date, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      '798',
      '1982',
      'test-composicion-fondo-clase-a',
      'Test Composicion Fondo - Clase A',
      JSON.stringify({
        fondoId: '798',
        claseId: '1982',
        slug: 'test-composicion-fondo-clase-a',
        nombre: 'Test Composicion Fondo - Clase A',
        composicionCartera: [],
      }),
      '2026-08-12',
      '2026-08-12T10:00:00.000Z',
    )
    db.close()

    const exportDir = join(
      process.cwd(),
      'datos/v1/finanzas/fci/fondos/test-composicion-fondo-clase-a',
    )
    mkdirSync(exportDir, { recursive: true })
    writeFileSync(
      join(exportDir, 'index.json'),
      JSON.stringify({
        fondoId: '798',
        claseId: '1982',
        nombre: 'Test Composicion Fondo - Clase A',
        composicionCartera: [{ nombre: 'Plazo Fijo', porcentaje: 80 }],
      }),
    )
    cleanups.push(() => rmSync(exportDir, { recursive: true, force: true }))

    const fondos = [
      {
        fondoId: '798',
        claseId: '1982',
        slug: 'test-composicion-fondo-clase-a',
        nombre: 'Test Composicion Fondo - Clase A',
        composicionCartera: [],
      },
    ]

    const recuperados = recuperarComposicionCartera(fondos, dbPath)

    expect(recuperados).toBe(1)
    expect(fondos[0].composicionCartera).toEqual([
      { nombre: 'Plazo Fijo', porcentaje: 80 },
    ])

    const updated = new Database(dbPath, { readonly: true })
    const payload = JSON.parse(
      updated
        .prepare('SELECT payload FROM current_fund_details WHERE class_id = ?')
        .get('1982').payload,
    )
    updated.close()

    expect(payload.composicionCartera).toEqual([
      { nombre: 'Plazo Fijo', porcentaje: 80 },
    ])
  })
})

describe('localizarLogosFondos', () => {
  it('reescribe URLs CAFCI a static/logos/fondos si el archivo ya existe', async () => {
    const source = join(
      process.cwd(),
      'datos/static/logos/fondos/00241G-5159107a.jpg',
    )
    expect(existsSync(source)).toBe(true)

    const fondos = [
      {
        sociedades: [
          {
            tipo: 'Administradora',
            nombre: 'Proahorro',
            logo: 'https://estadisticas.cafci.org.ar/assets/legacy/logos/00241G-5159107a.jpg',
          },
        ],
      },
    ]

    const localizados = await localizarLogosFondos(fondos)

    expect(localizados).toBe(1)
    expect(fondos[0].sociedades[0].logo).toBe(
      'https://api.argentinadatos.com/static/logos/fondos/00241G-5159107a.jpg',
    )
  })

  it('extrae el stem del archivo desde la URL CAFCI', () => {
    expect(
      logoFileStemFromUrl(
        'https://estadisticas.cafci.org.ar/assets/legacy/logos/00241G-5159107a.jpg',
      ),
    ).toBe('00241G-5159107a')
  })
})

describe('recuperarYLocalizarCamposFondo', () => {
  it('recupera calificadora y logos desde export/HEAD y localiza logos', async () => {
    const directory = join(tmpdir(), `fci-logos-${Date.now()}`)
    mkdirSync(directory, { recursive: true })
    cleanups.push(() => rmSync(directory, { recursive: true, force: true }))

    const dbPath = join(directory, 'db.sqlite')
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
        fund_id, class_id, slug, name, payload, source_date, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      '1',
      '99991',
      'test-logo-fondo-clase-a',
      'Test Logo Fondo - Clase A',
      JSON.stringify({
        fondoId: '1',
        claseId: '99991',
        slug: 'test-logo-fondo-clase-a',
        calificaciones: [
          {
            calificadora: null,
            calificacion: 'AAf',
            fecha: '2026-08-12',
          },
        ],
        sociedades: [
          {
            tipo: 'Administradora',
            nombre: 'Proahorro Administradora de Activos S.A.',
            logo: null,
          },
        ],
      }),
      '2026-08-12',
      '2026-08-12T10:00:00.000Z',
    )
    db.close()

    const exportDir = join(
      process.cwd(),
      'datos/v1/finanzas/fci/fondos/test-logo-fondo-clase-a',
    )
    mkdirSync(exportDir, { recursive: true })
    writeFileSync(
      join(exportDir, 'index.json'),
      JSON.stringify({
        fondoId: '1',
        claseId: '99991',
        calificaciones: [
          {
            calificadora: 'Fix',
            calificacion: 'AAf',
            fecha: '2025-12-29',
          },
        ],
        sociedades: [
          {
            tipo: 'Sociedad Gerente:',
            nombre: 'Proahorro Administradora de Activos S.A.',
            logo: 'https://estadisticas.cafci.org.ar/assets/legacy/logos/00241G-5159107a.jpg',
          },
        ],
      }),
    )
    cleanups.push(() => rmSync(exportDir, { recursive: true, force: true }))

    const fondos = [
      {
        fondoId: '1',
        claseId: '99991',
        slug: 'test-logo-fondo-clase-a',
        nombre: 'Test Logo Fondo - Clase A',
        calificaciones: [
          {
            calificadora: null,
            calificacion: 'AAf',
            fecha: '2026-08-12',
          },
        ],
        sociedades: [
          {
            tipo: 'Administradora',
            nombre: 'Proahorro Administradora de Activos S.A.',
            logo: null,
          },
        ],
        rendimientos: {},
      },
    ]

    const result = await recuperarYLocalizarCamposFondo(fondos, dbPath)

    expect(result.recuperados).toBe(1)
    expect(fondos[0].calificaciones[0].calificadora).toBe('Fix')
    expect(fondos[0].calificaciones[0].fecha).toBe('2025-12-29')
    expect(fondos[0].sociedades[0].logo).toBe(
      'https://api.argentinadatos.com/static/logos/fondos/00241G-5159107a.jpg',
    )
  })
})
