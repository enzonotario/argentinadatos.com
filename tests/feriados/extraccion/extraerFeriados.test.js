import { describe, expect, it } from 'vitest'
import { extraerFeriados } from '@/feriados/extraccion/extraerFeriados.js'

describe('extraerFeriados', () => {
  it(
    'extrae feriados desde La Nación',
    async () => {
      const feriados = await extraerFeriados(2026)

      expect(feriados.length).toBeGreaterThan(0)

      for (const feriado of feriados) {
        expect(feriado).toMatchObject({
          dia: expect.any(Number),
          mes: expect.any(Number),
          año: 2026,
          fecha: expect.stringMatching(/^2026-\d{2}-\d{2}$/),
          tipo: expect.stringMatching(/^(inamovible|trasladable|puente|turistico)$/),
          nombre: expect.any(String),
        })
        expect(feriado.nombre.length).toBeGreaterThan(0)
      }

      expect(feriados).toContainEqual(
        expect.objectContaining({
          fecha: '2026-01-01',
          nombre: 'Año nuevo',
        }),
      )
    },
    30000,
  )
})
