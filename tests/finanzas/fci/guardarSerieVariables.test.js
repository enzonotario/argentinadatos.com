import { describe, expect, it } from 'vitest'
import { guardarSerieVariables } from '@/finanzas/fci/guardado/guardarSerieVariables.esjs'
import { FciVariablesDatabaseService } from '@/finanzas/fci/databaseVariables/service.esjs'
import { leerRuta } from '@/utils/rutas.esjs'

const TEST_URL = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://test.turso.io'
const TEST_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'test-token'

describe('guardarSerieVariables', () => {
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

    await guardarSerieVariables(items, TEST_URL, TEST_AUTH_TOKEN)

    const db = new FciVariablesDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
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

    await guardarSerieVariables(items, TEST_URL, TEST_AUTH_TOKEN)

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
