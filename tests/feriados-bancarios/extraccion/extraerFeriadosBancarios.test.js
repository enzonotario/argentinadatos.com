import { describe, expect, it } from 'vitest'
import { extraerFeriadosBancarios } from '@/feriados-bancarios/extraccion/extraerFeriadosBancarios.js'

describe('extraerFeriadosBancarios', () => {
  it(
    'extrae feriados bancarios del BCRA',
    async () => {
      const feriados = await extraerFeriadosBancarios(2026)

      expect(feriados.length).toBeGreaterThan(0)

      for (const feriado of feriados) {
        expect(feriado).toMatchObject({
          fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          nombre: expect.any(String),
        })
        expect(feriado.nombre).not.toBe('')
        expect(feriado.fecha.startsWith('2026-')).toBe(true)
      }
    },
    { timeout: 15000 },
  )

  it(
    'incluye feriados conocidos de 2026',
    async () => {
      const feriados = await extraerFeriadosBancarios(2026)

      expect(feriados).toContainEqual({
        fecha: '2026-01-01',
        nombre: 'Año nuevo',
      })
      expect(feriados).toContainEqual({
        fecha: '2026-12-25',
        nombre: 'Navidad',
      })
    },
    { timeout: 15000 },
  )

  it(
    'extrae feriados bancarios de años anteriores',
    async () => {
      for (const año of [2024, 2025]) {
        const feriados = await extraerFeriadosBancarios(año)

        expect(feriados.length).toBeGreaterThan(0)

        for (const feriado of feriados) {
          expect(feriado.fecha.startsWith(`${año}-`)).toBe(true)
        }
      }
    },
    { timeout: 30000 },
  )
})
