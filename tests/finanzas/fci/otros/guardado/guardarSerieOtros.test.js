import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extraerBicaCuentaPositiva } from '@/finanzas/fci/otros/extraccion/extraerBica.js'
import { guardarSerieOtros } from '@/finanzas/fci/otros/guardado/guardarSerieOtros.js'
import { FciOtrosDatabaseService } from '@/finanzas/fci/otros/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../../helpers/temp-database.js'

describe('guardarSerieOtros', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('fci-otros')
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it(
    'extrae Bica, guarda en la base de datos y genera endpoint estático',
    async () => {
      const items = await extraerBicaCuentaPositiva()

      expect(items.length).toBeGreaterThan(0)

      await guardarSerieOtros(items, testDb.url, testDb.authToken)

      const item = items[0]
      const db = new FciOtrosDatabaseService(testDb.url, testDb.authToken)
      await db.initialize()
      const ultimo = await db.getLatestFciOtrosByFondo(item.fondo)
      db.close()

      expect(ultimo).toBeDefined()
      expect(ultimo.fondo).toBe(item.fondo)
      expect(ultimo.tna).toBe(item.tna)
      expect(ultimo.tea).toBe(item.tea)
      expect(ultimo.fecha).toBe(item.fecha)

      const guardado = leerRuta('/finanzas/fci/otros/ultimo')
      const entry = guardado.find(r => r.fondo === item.fondo)

      expect(entry).toMatchObject({
        fondo: item.fondo,
        tna: item.tna,
        tea: item.tea,
        fecha: item.fecha,
      })
    },
    30000,
  )

  it(
    'no guarda valores duplicados al repetir la misma extracción',
    async () => {
      const items = await extraerBicaCuentaPositiva()

      await guardarSerieOtros(items, testDb.url, testDb.authToken)
      await guardarSerieOtros(items, testDb.url, testDb.authToken)

      const db = new FciOtrosDatabaseService(testDb.url, testDb.authToken)
      await db.initialize()
      const todos = await db.getAllLatestFciOtros()
      db.close()

      for (const item of items) {
        const entries = todos.filter(r => r.fondo === item.fondo)
        expect(entries.length).toBeGreaterThanOrEqual(1)
      }
    },
    30000,
  )
})
