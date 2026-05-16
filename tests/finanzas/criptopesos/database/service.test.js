import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { CriptopesosDatabaseService } from '@/finanzas/criptopesos/database/service.js'

const TEST_URL = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://test.turso.io'
const TEST_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'test-token'

describe('CriptopesosDatabaseService', () => {
  let db

  beforeEach(async () => {
    db = new CriptopesosDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
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

  it('inserta un criptopeso', async () => {
    const timestamp = new Date().toISOString()
    await db.insertCriptopeso('ARGt', 'belo', 0.25, timestamp)

    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')

    expect(ultimo).toBeDefined()
    expect(ultimo.token).toBe('ARGt')
    expect(ultimo.entidad).toBe('belo')
    expect(ultimo.tna).toBe(0.25)
    expect(ultimo.timestamp).toBe(timestamp)
  })

  it('obtiene el ultimo criptopeso por entidad', async () => {
    const timestamp1 = new Date(Date.now() - 1000).toISOString()
    const timestamp2 = new Date().toISOString()

    await db.insertCriptopeso('ARGt', 'belo', 0.25, timestamp1)
    await db.insertCriptopeso('ARGt', 'belo', 0.30, timestamp2)

    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')

    expect(ultimo.tna).toBe(0.30)
  })

  it('obtiene todos los ultimos criptopesos', async () => {
    const timestamp = new Date().toISOString()

    await db.insertCriptopeso('ARGt', 'belo', 0.25, timestamp)
    await db.insertCriptopeso('wARS', 'Test', 0.24, timestamp)

    const todos = await db.getAllLatestCriptopesos()

    expect(todos.length).toBeGreaterThanOrEqual(2)
    expect(todos.find(r => r.token === 'ARGt' && r.entidad === 'belo')).toBeDefined()
    expect(todos.find(r => r.token === 'wARS' && r.entidad === 'Test')).toBeDefined()
  })

  it('retorna null si no existe la entidad', async () => {
    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')

    expect(ultimo).toBeNull()
  })
})

