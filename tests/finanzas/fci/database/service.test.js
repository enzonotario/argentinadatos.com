import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { FciOtrosDatabaseService } from '@/finanzas/fci/database/service.js'

const TEST_URL = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://test.turso.io'
const TEST_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'test-token'

describe('FciOtrosDatabaseService', () => {
  let db

  beforeEach(async () => {
    db = new FciOtrosDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
    await db.initialize()
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
  })

  it('inicializa la base de datos correctamente', () => {
    expect(db).toBeDefined()
  })

  it('inserta un FCI otro', async () => {
    const timestamp = new Date().toISOString()
    await db.insertFciOtros('NARANJA X', 0.21, 0.2314, 1000000, '2026-01-12', null, null, timestamp)

    const ultimo = await db.getLatestFciOtrosByFondo('NARANJA X')

    expect(ultimo).toBeDefined()
    expect(ultimo.fondo).toBe('NARANJA X')
    expect(ultimo.tna).toBe(0.21)
    expect(ultimo.tea).toBe(0.2314)
    expect(ultimo.tope).toBe(1000000)
    expect(ultimo.fecha).toBe('2026-01-12')
    expect(ultimo.timestamp).toBe(timestamp)
  })

  it('obtiene el ultimo FCI otro por fondo', async () => {
    const timestamp1 = new Date(Date.now() - 1000).toISOString()
    const timestamp2 = new Date().toISOString()

    await db.insertFciOtros('NARANJA X', 0.21, 0.2314, 1000000, '2026-01-12', null, null, timestamp1)
    await db.insertFciOtros('NARANJA X', 0.25, 0.2800, 1200000, '2026-01-13', null, null, timestamp2)

    const ultimo = await db.getLatestFciOtrosByFondo('NARANJA X')

    expect(ultimo.tna).toBe(0.25)
    expect(ultimo.tea).toBe(0.2800)
    expect(ultimo.tope).toBe(1200000)
  })

  it('obtiene todos los ultimos FCI otros', async () => {
    const timestamp = new Date().toISOString()

    await db.insertFciOtros('NARANJA X', 0.21, 0.2314, 1000000, '2026-01-12', null, null, timestamp)
    await db.insertFciOtros('FIWIND', 0.32, 0.3769, 750000, '2026-01-12', null, null, timestamp)

    const todos = await db.getAllLatestFciOtros()

    expect(todos.length).toBeGreaterThanOrEqual(2)
    expect(todos.find(r => r.fondo === 'NARANJA X')).toBeDefined()
    expect(todos.find(r => r.fondo === 'FIWIND')).toBeDefined()
  })

  it('retorna null si no existe el fondo', async () => {
    const ultimo = await db.getLatestFciOtrosByFondo('no-existe')

    expect(ultimo).toBeNull()
  })

  it('guarda condiciones y condicionesCorto', async () => {
    const timestamp = new Date().toISOString()
    await db.insertFciOtros('SUPERVIELLE', 0.21, 0.2336, 1000000, '2026-01-12', null, 'Solo Clientes Plan Sueldo.', timestamp)

    const ultimo = await db.getLatestFciOtrosByFondo('SUPERVIELLE')

    expect(ultimo.condiciones).toBeNull()
    expect(ultimo.condicionesCorto).toBe('Solo Clientes Plan Sueldo.')
  })

  it('obtiene FCI otros por fecha', async () => {
    const timestamp1 = new Date(Date.now() - 1000).toISOString()
    const timestamp2 = new Date().toISOString()

    await db.insertFciOtros('NARANJA X', 0.21, 0.2314, 1000000, '2026-01-12', null, null, timestamp1)
    await db.insertFciOtros('NARANJA X', 0.25, 0.2800, 1200000, '2026-01-13', null, null, timestamp2)

    const datosFecha = await db.getFciOtrosByFecha('2026-01-12')

    expect(datosFecha.length).toBeGreaterThanOrEqual(1)
    expect(datosFecha.find(r => r.fondo === 'NARANJA X' && r.fecha === '2026-01-12')).toBeDefined()
  })
})
