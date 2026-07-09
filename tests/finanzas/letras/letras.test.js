import { describe, expect, it } from 'vitest'
import {
  extraerLetras,
  extraerLetrasDesdeSheets,
} from '@/finanzas/letras/extraccion/extraerLetras.js'

describe('extraerLetrasDesdeSheets', () => {
  it(
    'obtiene datos del Google Sheet de letras',
    async () => {
      const datos = await extraerLetrasDesdeSheets()

      expect(Array.isArray(datos)).toBe(true)

      if (datos.length > 0) {
        for (const item of datos) {
          expect(item.ticker).toMatch(/^[ST]\d{2}[EFMAYLGJSOND]\d/)

          if (item.vpv !== null) {
            expect(typeof item.vpv).toBe('number')
            expect(item.vpv).toBeGreaterThan(100)
          }
        }
      }
    },
    30000,
  )
})

describe('extraerLetras', () => {
  it(
    'obtiene datos reales de LECAPs y BONCAPs desde fuentes oficiales',
    async () => {
      const datos = await extraerLetras()

      expect(Array.isArray(datos)).toBe(true)

      if (datos.length > 0) {
        for (const item of datos) {
          expect(item.ticker).toMatch(/^[ST]\d{2}[EFMAYLGJSOND]\d/)
          expect(item.fechaVencimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/)

          if (item.fechaEmision) {
            expect(item.fechaEmision).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(item.fechaEmision <= item.fechaVencimiento).toBe(true)
          }

          if (item.tem !== null) {
            expect(typeof item.tem).toBe('number')
            expect(item.tem).toBeGreaterThan(0)
          }

          expect(item.vpv).toBeGreaterThan(100)
        }
      }
    },
    60000,
  )
})
