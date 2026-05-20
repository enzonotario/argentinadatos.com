import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { FciVariablesDatabaseService } from '@/finanzas/fci/variables/database/service.js'
import { crearBaseDeDatosTemporal } from '../../../../helpers/sqlite.js'

describe('FciVariablesDatabaseService', () => {
  let db
  let testDb

  beforeEach(async () => {
    testDb = crearBaseDeDatosTemporal('fci-variables')
    db = new FciVariablesDatabaseService(testDb.url, testDb.authToken)
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

  it('inserta un FCI variable', async () => {
    const timestamp = new Date().toISOString()
    await db.insertFciVariables(
      'GLOBAL66',
      'Compass Liquidez - Clase A',
      'billetera',
      0.2048,
      0.2273,
      null,
      '2026-04-23',
      'Solo clientes',
      'Solo clientes B2C',
      timestamp,
    )

    const ultimo = await db.getLatestFciVariablesByNombre('GLOBAL66')

    expect(ultimo).toBeDefined()
    expect(ultimo.nombre).toBe('GLOBAL66')
    expect(ultimo.fondo).toBe('Compass Liquidez - Clase A')
    expect(ultimo.tipo).toBe('billetera')
    expect(ultimo.tna).toBe(0.2048)
    expect(ultimo.tea).toBe(0.2273)
    expect(ultimo.tope).toBeNull()
    expect(ultimo.fecha).toBe('2026-04-23')
    expect(ultimo.timestamp).toBe(timestamp)
  })

  it('retorna null si no existe el nombre', async () => {
    const ultimo = await db.getLatestFciVariablesByNombre('no-existe')

    expect(ultimo).toBeNull()
  })
})
