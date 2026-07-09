import { describe, expect, it } from 'vitest'
import { logGrupo } from '@/log.js'
import { extraerRemesas } from '@/finanzas/remesas/extraccion/extraerRemesas.js'
import { extraerCocosRemesas } from '@/finanzas/remesas/extraccion/extraerCocosRemesas.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe.skipIf(!tieneFirecrawl)('extraerRemesas', () => {
  it(
    'extrae tabla de remesas desde dolarito.ar/remotito',
    async () => {
      const payload = await extraerRemesas()
      const remesas = payload.remesas

      expect(payload.fechaActualizacion).toBeTruthy()
      expect(payload.fechaActualizacion).toMatch(/Z$/)
      expect(Array.isArray(remesas)).toBe(true)
      expect(remesas.length).toBeGreaterThan(0)

      const companias = new Set(remesas.map(r => r.compania))
      expect(companias.size).toBe(remesas.length)

      for (const row of remesas) {
        expect(typeof row.compania).toBe('string')
        expect(row.compania.length).toBeGreaterThan(0)
        expect(typeof row.cuentaPropia).toBe('boolean')
        expect(typeof row.inversiones).toBe('boolean')
        expect(typeof row.tarjetaUsa).toBe('boolean')
        if (row.detalles) {
          expect(typeof row.detalles).toBe('object')
        }
      }

      const takenos = remesas.find(
        row => row.compania.toLowerCase() === 'takenos',
      )

      expect(takenos).toBeDefined()

      if (takenos?.detalles?.costoRecibirPagos) {
        expect(takenos.detalles.costoRecibirPagos).toContain('Para ACH es 0')
      }

      const cocos = remesas.find(
        row => row.compania.toLowerCase() === 'cocos',
      )

      if (cocos) {
        expect(cocos.compania).toBe('Cocos')
        expect(cocos.cuentaPropia).toBe(true)
        expect(cocos.moneda).toBe('FIAT')
      }
    },
    120000,
  )
})

describe('extraerCocosRemesas', () => {
  it(
    'extrae Cocos desde rendimientos.co/tty.js',
    async () => {
      const log = logGrupo({ fuente: 'test', tipo: 'extraccion' })
      const remesa = await extraerCocosRemesas(log)

      expect(remesa).toMatchObject({
        compania: 'Cocos',
        cuentaPropia: expect.any(Boolean),
        moneda: 'FIAT',
        inversiones: expect.any(Boolean),
        tarjetaUsa: expect.any(Boolean),
      })

      if (remesa.costoRecibirPagos) {
        expect(typeof remesa.costoRecibirPagos).toBe('string')
      }
    },
    30000,
  )
})
