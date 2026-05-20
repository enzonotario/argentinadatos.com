import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { CriptopesosDatabaseService } from '@/finanzas/criptopesos/database/service.js'
import { crearBaseDeDatosTemporal } from '../../../helpers/sqlite.js'

describe('CriptopesosDatabaseService', () => {
  let db
  let testDb

  beforeEach(async () => {
    testDb = crearBaseDeDatosTemporal('criptopesos')
    db = new CriptopesosDatabaseService(testDb.url, testDb.authToken)
    await db.initialize()
  })

  afterEach(() => {
    if (db) {
      db.close()
    }
    testDb?.cleanup()
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
    await db.insertCriptopeso('ARGt', 'belo', 0.3, timestamp2)

    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')

    expect(ultimo.tna).toBe(0.3)
  })

  it('obtiene todos los ultimos criptopesos', async () => {
    const timestamp = new Date().toISOString()

    await db.insertCriptopeso('ARGt', 'belo', 0.25, timestamp)
    await db.insertCriptopeso('wARS', 'Test', 0.24, timestamp)

    const todos = await db.getAllLatestCriptopesos()

    expect(todos.length).toBeGreaterThanOrEqual(2)
    expect(
      todos.find(r => r.token === 'ARGt' && r.entidad === 'belo'),
    ).toBeDefined()
    expect(
      todos.find(r => r.token === 'wARS' && r.entidad === 'Test'),
    ).toBeDefined()
  })

  it('retorna null si no existe la entidad', async () => {
    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')

    expect(ultimo).toBeNull()
  })
})
