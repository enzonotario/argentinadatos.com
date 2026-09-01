import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { extraerRem } from '@/finanzas/rem/extraccion/extraerRem.js'
import { guardarRem } from '@/finanzas/rem/guardado/guardarRem.js'
import { RemDatabaseService } from '@/finanzas/rem/database/service.js'
import { leerRuta } from '@/utils/rutas.js'

const DB_PATH = '/tmp/rem-test.sqlite'
const TEST_URL = `file:${DB_PATH}`

const URLS_REM_2026 = [
  'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-rem-marzo-de-2026/',
  'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-febrero-de-2026/',
]

describe('guardarRem', () => {
  afterEach(() => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  })

  it(
    'extrae, guarda en PocketBase y genera endpoints estáticos',
    async () => {
      const items = await extraerRem(URLS_REM_2026)

      expect(items.length).toBeGreaterThan(0)

      const endpoints = await guardarRem(items, TEST_URL)

      const db = new RemDatabaseService(TEST_URL)
      await db.initialize()
      const todos = await db.getAllExpectativas()
      const ultimo = await db.getLatestExpectativas()
      db.close()

      expect(todos.length).toBe(items.length)
      expect(ultimo.length).toBeGreaterThan(0)
      expect(ultimo.every(item => item.informe === '2026-03')).toBe(true)

      expect(endpoints).toContain('/finanzas/rem/ultimo')
      expect(endpoints).toContain('/finanzas/rem/2026/03')
      expect(endpoints).toContain('/finanzas/rem/2026/02')
      expect(leerRuta('/finanzas/rem')).toEqual(endpoints)
      expect(leerRuta('/finanzas/rem/ultimo')).toEqual(ultimo)

      expect(leerRuta('/rems')).toContain('/rems/ultimo')
      expect(leerRuta('/rems/ultimo')).toEqual(ultimo)
    },
    60000,
  )
})
