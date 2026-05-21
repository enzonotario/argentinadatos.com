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
        fundId: '798',
        classId: '1982',
        slug: 'mercado-fondo-clase-a',
        name: 'Mercado Fondo - Clase A',
        date: '2026-05-21',
        performance: {
          shareValue: 24088.316,
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
      fundId: '798',
      classId: '1982',
      slug: 'mercado-fondo-clase-a',
      name: 'Mercado Fondo - Clase A',
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
        },
      ],
    })
  })
})
