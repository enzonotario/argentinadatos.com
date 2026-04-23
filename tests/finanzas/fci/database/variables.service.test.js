import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { FciVariablesDatabaseService } from '@/finanzas/fci/databaseVariables/service.esjs'

const TEST_URL = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://test.turso.io'
const TEST_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'test-token'

describe('FciVariablesDatabaseService', () => {
  let db

  beforeEach(async () => {
    db = new FciVariablesDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
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

  it('inserta un FCI variable', async () => {
    const timestamp = new Date().toISOString()
    await db.insertFciVariables('GLOBAL66', 'billetera', 0.2048, 0.2273, null, '2026-04-23', 'Solo clientes', 'Solo clientes B2C', timestamp)

    const ultimo = await db.getLatestFciVariablesByFondo('GLOBAL66')

    expect(ultimo).toBeDefined()
    expect(ultimo.fondo).toBe('GLOBAL66')
    expect(ultimo.tipo).toBe('billetera')
    expect(ultimo.tna).toBe(0.2048)
    expect(ultimo.tea).toBe(0.2273)
    expect(ultimo.tope).toBeNull()
    expect(ultimo.fecha).toBe('2026-04-23')
    expect(ultimo.timestamp).toBe(timestamp)
  })

  it('retorna null si no existe el fondo', async () => {
    const ultimo = await db.getLatestFciVariablesByFondo('no-existe')

    expect(ultimo).toBeNull()
  })
})
