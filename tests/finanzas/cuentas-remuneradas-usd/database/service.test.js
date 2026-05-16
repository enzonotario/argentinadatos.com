import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { CuentasRemuneradasUsdDatabaseService } from '@/finanzas/cuentas-remuneradas-usd/database/service.js'

const TEST_URL = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://test.turso.io'
const TEST_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'test-token'

describe('CuentasRemuneradasUsdDatabaseService', () => {
  let db

  beforeEach(async () => {
    db = new CuentasRemuneradasUsdDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
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

  it('inserta una cuenta remunerada USD', async () => {
    const timestamp = new Date().toISOString()
    await db.insertCuentaRemuneradaUsd('GALICIA', 3.5, 10000, timestamp)

    const ultimo = await db.getLatestCuentaRemuneradaByEntity('GALICIA')

    expect(ultimo).toBeDefined()
    expect(ultimo.entidad).toBe('GALICIA')
    expect(ultimo.tasa).toBe(3.5)
    expect(ultimo.tope).toBe(10000)
    expect(ultimo.timestamp).toBe(timestamp)
  })

  it('obtiene la ultima cuenta remunerada por entidad', async () => {
    const timestamp1 = new Date(Date.now() - 1000).toISOString()
    const timestamp2 = new Date().toISOString()

    await db.insertCuentaRemuneradaUsd('GALICIA', 3.5, 10000, timestamp1)
    await db.insertCuentaRemuneradaUsd('GALICIA', 4.0, 15000, timestamp2)

    const ultimo = await db.getLatestCuentaRemuneradaByEntity('GALICIA')

    expect(ultimo.tasa).toBe(4.0)
    expect(ultimo.tope).toBe(15000)
  })

  it('obtiene todas las ultimas cuentas remuneradas USD', async () => {
    const timestamp = new Date().toISOString()

    await db.insertCuentaRemuneradaUsd('GALICIA', 3.5, 10000, timestamp)
    await db.insertCuentaRemuneradaUsd('SANTANDER', 3.2, 20000, timestamp)

    const todos = await db.getAllLatestCuentasRemuneradasUsd()

    expect(todos.length).toBeGreaterThanOrEqual(2)
    expect(todos.find(r => r.entidad === 'GALICIA')).toBeDefined()
    expect(todos.find(r => r.entidad === 'SANTANDER')).toBeDefined()
  })

  it('retorna null si no existe la entidad', async () => {
    const ultimo = await db.getLatestCuentaRemuneradaByEntity('no-existe')

    expect(ultimo).toBeNull()
  })
})
