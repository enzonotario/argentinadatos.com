import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extraerGlobal66CuentaRemunerada } from '@/finanzas/fci/variables/extraccion/extraerGlobal66.js'
import { guardarSerieVariables } from '@/finanzas/fci/variables/guardado/guardarSerieVariables.js'
import { FciVariablesDatabaseService } from '@/finanzas/fci/variables/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../../helpers/sqlite.js'

const tieneGlobal66 =
  Boolean(import.meta.env.VITE_GLOBAL66_API_URL) &&
  Boolean(import.meta.env.VITE_GLOBAL66_API_KEY)

describe.skipIf(!tieneGlobal66)('guardarSerieVariables', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('fci-variables')
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it(
    'extrae Global66, guarda en la base de datos y genera endpoint estático',
    async () => {
      const item = await extraerGlobal66CuentaRemunerada()

      expect(item).toMatchObject({
        nombre: 'GLOBAL66',
      })

      const items = [item]
      await guardarSerieVariables(items, testDb.url, testDb.authToken)

      const db = new FciVariablesDatabaseService(testDb.url, testDb.authToken)
      await db.initialize()
      const ultimo = await db.getLatestFciVariablesByNombre(item.nombre)
      db.close()

      expect(ultimo).toBeDefined()
      expect(ultimo.nombre).toBe(item.nombre)
      expect(ultimo.fondo).toBe(item.fondo)
      expect(ultimo.tna).toBe(item.tna)
      expect(ultimo.tea).toBe(item.tea)
      expect(ultimo.fecha).toBe(item.fecha)
      expect(ultimo.tipo).toBe(item.tipo)

      const guardado = leerRuta('/finanzas/fci/variables/ultimo')
      const entry = guardado.find(r => r.nombre === item.nombre)

      expect(entry).toMatchObject({
        nombre: item.nombre,
        fondo: item.fondo,
        tipo: item.tipo,
        tna: item.tna,
        tea: item.tea,
        tope: item.tope,
        fecha: item.fecha,
      })
    },
    120000,
  )
})
