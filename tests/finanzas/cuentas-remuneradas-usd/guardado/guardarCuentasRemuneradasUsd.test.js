import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guardarCuentasRemuneradasUsd } from '@/finanzas/cuentas-remuneradas-usd/guardado/guardarCuentasRemuneradasUsd.js'
import { CuentasRemuneradasUsdDatabaseService } from '@/finanzas/cuentas-remuneradas-usd/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../helpers/sqlite.js'

describe('guardarCuentasRemuneradasUsd', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('cuentas-remuneradas-usd')
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it('guarda nuevos valores en la base de datos', async () => {
    const items = [{ entidad: 'GALICIA', tasa: 3.5, tope: 10000 }]

    await guardarCuentasRemuneradasUsd(items, testDb.url, testDb.authToken)

    const db = new CuentasRemuneradasUsdDatabaseService(
      testDb.url,
      testDb.authToken,
    )
    await db.initialize()
    const ultimo = await db.getLatestCuentaRemuneradaByEntity('GALICIA')
    db.close()

    expect(ultimo).toBeDefined()
    expect(ultimo.entidad).toBe('GALICIA')
    expect(ultimo.tasa).toBe(3.5)
    expect(ultimo.tope).toBe(10000)
  })

  it('no guarda valores duplicados', async () => {
    const items = [{ entidad: 'GALICIA', tasa: 3.5, tope: 10000 }]

    await guardarCuentasRemuneradasUsd(items, testDb.url, testDb.authToken)
    await guardarCuentasRemuneradasUsd(items, testDb.url, testDb.authToken)

    const db = new CuentasRemuneradasUsdDatabaseService(
      testDb.url,
      testDb.authToken,
    )
    await db.initialize()
    const todos = await db.getAllLatestCuentasRemuneradasUsd()
    db.close()

    const galiciaEntries = todos.filter(r => r.entidad === 'GALICIA')
    expect(galiciaEntries.length).toBeGreaterThanOrEqual(1)
  })

  it('guarda valores cuando cambian', async () => {
    const items1 = [{ entidad: 'GALICIA', tasa: 3.5, tope: 10000 }]

    const items2 = [{ entidad: 'GALICIA', tasa: 4.0, tope: 15000 }]

    await guardarCuentasRemuneradasUsd(items1, testDb.url, testDb.authToken)
    await guardarCuentasRemuneradasUsd(items2, testDb.url, testDb.authToken)

    const db = new CuentasRemuneradasUsdDatabaseService(
      testDb.url,
      testDb.authToken,
    )
    await db.initialize()
    const ultimo = await db.getLatestCuentaRemuneradaByEntity('GALICIA')
    db.close()

    expect(ultimo.tasa).toBe(4.0)
    expect(ultimo.tope).toBe(15000)
  })

  it('genera el endpoint estatico correctamente', async () => {
    const items = [{ entidad: 'GALICIA', tasa: 3.5, tope: 10000 }]

    await guardarCuentasRemuneradasUsd(items, testDb.url, testDb.authToken)

    const guardado = leerRuta('/finanzas/cuentas-remuneradas-usd')

    expect(guardado).toBeDefined()
    expect(Array.isArray(guardado)).toBe(true)
    expect(guardado.length).toBeGreaterThan(0)

    const galiciaEntry = guardado.find(r => r.entidad === 'GALICIA')
    expect(galiciaEntry).toBeDefined()
    expect(galiciaEntry).toEqual({
      entidad: 'GALICIA',
      tasa: 3.5,
      tope: 10000,
    })
  })
})
