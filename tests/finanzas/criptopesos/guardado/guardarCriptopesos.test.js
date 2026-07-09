import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extraerBelo } from '@/finanzas/criptopesos/extraccion/extraerBelo.js'
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

  it(
    'extrae, guarda, evita duplicados y genera endpoint estático',
    async () => {
      const items = await extraerBelo()

      expect(items.length).toBeGreaterThan(0)

      await guardarCriptopesos(items, testDb.url, testDb.authToken)
      await guardarCriptopesos(items, testDb.url, testDb.authToken)

      const item = items[0]
      const db = new CriptopesosDatabaseService(testDb.url, testDb.authToken)
      await db.initialize()
      const ultimo = await db.getLatestCriptopesoByEntity(
        item.token,
        item.entidad,
      )
      const todos = await db.getAllLatestCriptopesos()
      db.close()

      expect(ultimo).toBeDefined()
      expect(ultimo.token).toBe(item.token)
      expect(ultimo.entidad).toBe(item.entidad)
      expect(ultimo.tna).toBe(item.tna)

      const entries = todos.filter(
        r => r.entidad === item.entidad && r.token === item.token,
      )
      expect(entries).toHaveLength(1)

      const guardado = leerRuta('/finanzas/criptopesos')
      const entry = guardado.find(
        r => r.entidad === item.entidad && r.token === item.token,
      )

      expect(entry).toMatchObject({
        token: item.token,
        entidad: item.entidad,
        tna: item.tna,
      })
    },
    30000,
  )
})
