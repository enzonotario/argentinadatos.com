import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guardarSerieVariables } from '@/finanzas/fci/variables/guardado/guardarSerieVariables.js'
import { FciVariablesDatabaseService } from '@/finanzas/fci/variables/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../../helpers/sqlite.js'

describe('guardarSerieVariables', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('fci-variables')
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it('guarda nuevos valores en la base de datos', async () => {
    const items = [
      {
        nombre: 'GLOBAL66',
        fondo: 'Compass Liquidez - Clase A',
        tipo: 'billetera',
        tna: 0.2048,
        tea: 0.2273,
        tope: null,
        fecha: '2026-04-23',
        condiciones: 'Solo clientes',
        condicionesCorto: 'Solo clientes B2C',
      },
    ]

    await guardarSerieVariables(items, testDb.url, testDb.authToken)

    const db = new FciVariablesDatabaseService(testDb.url, testDb.authToken)
    await db.initialize()
    const ultimo = await db.getLatestFciVariablesByNombre('GLOBAL66')
    db.close()

    expect(ultimo).toBeDefined()
    expect(ultimo.nombre).toBe('GLOBAL66')
    expect(ultimo.fondo).toBe('Compass Liquidez - Clase A')
    expect(ultimo.tna).toBe(0.2048)
    expect(ultimo.tea).toBe(0.2273)
    expect(ultimo.tope).toBeNull()
    expect(ultimo.fecha).toBe('2026-04-23')
    expect(ultimo.tipo).toBe('billetera')
  })

  it('genera el endpoint estatico correctamente', async () => {
    const items = [
      {
        nombre: 'GLOBAL66',
        fondo: 'Compass Liquidez - Clase A',
        tipo: 'billetera',
        tna: 0.2048,
        tea: 0.2273,
        tope: null,
        fecha: '2026-04-23',
        condiciones: 'Solo clientes',
        condicionesCorto: 'Solo clientes B2C',
      },
    ]

    await guardarSerieVariables(items, testDb.url, testDb.authToken)

    const guardado = leerRuta('/finanzas/fci/variables/ultimo')

    expect(guardado).toBeDefined()
    expect(Array.isArray(guardado)).toBe(true)
    expect(guardado.length).toBeGreaterThan(0)

    const global66Entry = guardado.find(r => r.nombre === 'GLOBAL66')
    expect(global66Entry).toBeDefined()
    expect(global66Entry).toEqual({
      nombre: 'GLOBAL66',
      fondo: 'Compass Liquidez - Clase A',
      tipo: 'billetera',
      tna: 0.2048,
      tea: 0.2273,
      tope: null,
      fecha: '2026-04-23',
      condiciones: 'Solo clientes',
      condicionesCorto: 'Solo clientes B2C',
    })
  })
})
