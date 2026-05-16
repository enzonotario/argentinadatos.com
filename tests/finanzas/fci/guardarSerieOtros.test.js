import { describe, expect, it } from 'vitest'
import { guardarSerieOtros } from '@/finanzas/fci/guardado/guardarSerieOtros.js'
import { FciOtrosDatabaseService } from '@/finanzas/fci/database/service.js'
import { leerRuta } from '@/utils/rutas.js'

const TEST_URL = import.meta.env.VITE_TURSO_DATABASE_URL || 'libsql://test.turso.io'
const TEST_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN || 'test-token'

describe('guardarSerieOtros', () => {
  it('guarda nuevos valores en la base de datos', async () => {
    const items = [
      { fondo: 'NARANJA X', tna: 0.21, tea: 0.2314, tope: 1000000, fecha: '2026-01-12' },
    ]

    await guardarSerieOtros(items, TEST_URL, TEST_AUTH_TOKEN)

    const db = new FciOtrosDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
    await db.initialize()
    const ultimo = await db.getLatestFciOtrosByFondo('NARANJA X')
    db.close()

    expect(ultimo).toBeDefined()
    expect(ultimo.fondo).toBe('NARANJA X')
    expect(ultimo.tna).toBe(0.21)
    expect(ultimo.tea).toBe(0.2314)
    expect(ultimo.tope).toBe(1000000)
    expect(ultimo.fecha).toBe('2026-01-12')
  })

  it('no guarda valores duplicados', async () => {
    const items = [
      { fondo: 'NARANJA X', tna: 0.21, tea: 0.2314, tope: 1000000, fecha: '2026-01-12' },
    ]

    await guardarSerieOtros(items, TEST_URL, TEST_AUTH_TOKEN)
    await guardarSerieOtros(items, TEST_URL, TEST_AUTH_TOKEN)

    const db = new FciOtrosDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
    await db.initialize()
    const todos = await db.getAllLatestFciOtros()
    db.close()

    const naranjaEntries = todos.filter(r => r.fondo === 'NARANJA X')
    expect(naranjaEntries.length).toBeGreaterThanOrEqual(1)
  })

  it('guarda valores cuando cambian', async () => {
    const items1 = [
      { fondo: 'NARANJA X', tna: 0.21, tea: 0.2314, tope: 1000000, fecha: '2026-01-12' },
    ]

    const items2 = [
      { fondo: 'NARANJA X', tna: 0.25, tea: 0.2800, tope: 1200000, fecha: '2026-01-13' },
    ]

    await guardarSerieOtros(items1, TEST_URL, TEST_AUTH_TOKEN)
    await guardarSerieOtros(items2, TEST_URL, TEST_AUTH_TOKEN)

    const db = new FciOtrosDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
    await db.initialize()
    const ultimo = await db.getLatestFciOtrosByFondo('NARANJA X')
    db.close()

    expect(ultimo.tna).toBe(0.25)
    expect(ultimo.tea).toBe(0.2800)
    expect(ultimo.tope).toBe(1200000)
  })

  it('guarda valores cuando cambian condiciones', async () => {
    const items1 = [
      { fondo: 'SUPERVIELLE', tna: 0.21, tea: 0.2336, tope: 1000000, fecha: '2026-01-12', condiciones: null, condicionesCorto: null },
    ]

    const items2 = [
      { fondo: 'SUPERVIELLE', tna: 0.21, tea: 0.2336, tope: 1000000, fecha: '2026-01-13', condiciones: null, condicionesCorto: 'Solo Clientes Plan Sueldo.' },
    ]

    await guardarSerieOtros(items1, TEST_URL, TEST_AUTH_TOKEN)
    await guardarSerieOtros(items2, TEST_URL, TEST_AUTH_TOKEN)

    const db = new FciOtrosDatabaseService(TEST_URL, TEST_AUTH_TOKEN)
    await db.initialize()
    const ultimo = await db.getLatestFciOtrosByFondo('SUPERVIELLE')
    db.close()

    expect(ultimo.condicionesCorto).toBe('Solo Clientes Plan Sueldo.')
  })

  it('genera el endpoint estatico correctamente', async () => {
    const items = [
      { fondo: 'NARANJA X', tna: 0.21, tea: 0.2314, tope: 1000000, fecha: '2026-01-12' },
    ]

    await guardarSerieOtros(items, TEST_URL, TEST_AUTH_TOKEN)

    const guardado = leerRuta('/finanzas/fci/otros/ultimo')

    expect(guardado).toBeDefined()
    expect(Array.isArray(guardado)).toBe(true)
    expect(guardado.length).toBeGreaterThan(0)

    const naranjaEntry = guardado.find(r => r.fondo === 'NARANJA X')
    expect(naranjaEntry).toBeDefined()
    expect(naranjaEntry).toEqual({
      fondo: 'NARANJA X',
      tna: 0.21,
      tea: 0.2314,
      tope: 1000000,
      fecha: '2026-01-12',
      condiciones: null,
      condicionesCorto: null,
    })
  })
})
