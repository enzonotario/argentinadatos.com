import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extraerGalicia } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerGalicia.js'
import { guardarCuentasRemuneradasUsd } from '@/finanzas/cuentas-remuneradas-usd/guardado/guardarCuentasRemuneradasUsd.js'
import { CuentasRemuneradasUsdDatabaseService } from '@/finanzas/cuentas-remuneradas-usd/database/service.js'
import { leerRuta } from '@/utils/rutas.js'
import { crearBaseDeDatosTemporal } from '../../../helpers/sqlite.js'

const tieneIaCompleta =
  import.meta.env.VITE_RUN_AI_TESTS === 'true' &&
  Boolean(import.meta.env.VITE_TABSTACK_API_KEY) &&
  Boolean(import.meta.env.VITE_OPENROUTER_KEY)

describe.skipIf(!tieneIaCompleta)('guardarCuentasRemuneradasUsd', () => {
  let testDb

  beforeEach(() => {
    testDb = crearBaseDeDatosTemporal('cuentas-remuneradas-usd')
    import.meta.env.VITE_FORCE_IA = 'true'
  })

  afterEach(() => {
    testDb?.cleanup()
  })

  it(
    'extrae Galicia, guarda en la base de datos y genera endpoint estático',
    async () => {
      const items = await extraerGalicia()

      expect(items.length).toBeGreaterThan(0)

      await guardarCuentasRemuneradasUsd(items, testDb.url, testDb.authToken)

      const item = items[0]
      const db = new CuentasRemuneradasUsdDatabaseService(
        testDb.url,
        testDb.authToken,
      )
      await db.initialize()
      const ultimo = await db.getLatestCuentaRemuneradaByEntity(item.entidad)
      db.close()

      expect(ultimo).toBeDefined()
      expect(ultimo.entidad).toBe(item.entidad)
      expect(ultimo.tasa).toBe(item.tasa)
      expect(ultimo.tope).toBe(item.tope ?? null)

      const guardado = leerRuta('/finanzas/cuentas-remuneradas-usd')

      expect(Array.isArray(guardado)).toBe(true)
      const entry = guardado.find(r => r.entidad === item.entidad)
      expect(entry).toMatchObject({
        entidad: item.entidad,
        tasa: item.tasa,
        tope: item.tope ?? null,
      })
    },
    60000,
  )
})
