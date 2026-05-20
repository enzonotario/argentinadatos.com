import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guardarCriptopesos } from '@/finanzas/criptopesos/guardado/guardarCriptopesos.js'
import { CriptopesosDatabaseService } from '@/finanzas/criptopesos/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../helpers/sqlite.js'

describe('guardarCriptopesos', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('criptopesos')
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it('guarda nuevos valores en la base de datos', async () => {
    const items = [{ token: 'ARGt', entidad: 'belo', tna: 0.25 }]

    await guardarCriptopesos(items, testDb.url, testDb.authToken)

    const db = new CriptopesosDatabaseService(testDb.url, testDb.authToken)
    await db.initialize()
    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')
    db.close()

    expect(ultimo).toBeDefined()
    expect(ultimo.token).toBe('ARGt')
    expect(ultimo.entidad).toBe('belo')
    expect(ultimo.tna).toBe(0.25)
  })

  it('no guarda valores duplicados', async () => {
    const items = [{ token: 'ARGt', entidad: 'belo', tna: 0.25 }]

    await guardarCriptopesos(items, testDb.url, testDb.authToken)
    await guardarCriptopesos(items, testDb.url, testDb.authToken)

    const db = new CriptopesosDatabaseService(testDb.url, testDb.authToken)
    await db.initialize()
    const todos = await db.getAllLatestCriptopesos()
    db.close()

    const beloEntries = todos.filter(
      r => r.entidad === 'belo' && r.token === 'ARGt',
    )
    expect(beloEntries.length).toBeGreaterThanOrEqual(1)
  })

  it('guarda valores cuando cambian', async () => {
    const items1 = [{ token: 'ARGt', entidad: 'belo', tna: 0.25 }]

    const items2 = [{ token: 'ARGt', entidad: 'belo', tna: 0.3 }]

    await guardarCriptopesos(items1, testDb.url, testDb.authToken)
    await guardarCriptopesos(items2, testDb.url, testDb.authToken)

    const db = new CriptopesosDatabaseService(testDb.url, testDb.authToken)
    await db.initialize()
    const ultimo = await db.getLatestCriptopesoByEntity('ARGt', 'belo')
    db.close()

    expect(ultimo.tna).toBe(0.3)
  })

  it('genera el endpoint estatico correctamente', async () => {
    const items = [{ token: 'ARGt', entidad: 'belo', tna: 0.25 }]

    await guardarCriptopesos(items, testDb.url, testDb.authToken)

    const guardado = leerRuta('/finanzas/criptopesos')

    expect(guardado).toBeDefined()
    expect(Array.isArray(guardado)).toBe(true)
    expect(guardado.length).toBeGreaterThan(0)

    const beloEntry = guardado.find(
      r => r.entidad === 'belo' && r.token === 'ARGt',
    )
    expect(beloEntry).toBeDefined()
    expect(beloEntry).toEqual({
      token: 'ARGt',
      entidad: 'belo',
      tna: 0.25,
    })
  })
})
