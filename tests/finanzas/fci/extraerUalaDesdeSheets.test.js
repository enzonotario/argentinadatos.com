import { describe, expect, it } from 'vitest'
import { extraerUalaCuentaRemuneradaDesdeSheets } from '@/finanzas/extraccion/extraerUalaDesdeSheets.js'

describe('extraerUalaDesdeSheets', () => {
  it('extrae Uala Cuenta Remunerada desde Google Sheets correctamente', async () => {
    const resultado = await extraerUalaCuentaRemuneradaDesdeSheets()

    expect(resultado.length).toBeGreaterThan(0)
    expect(resultado[0]).toMatchObject({
      fecha: expect.any(String),
      fondo: expect.stringMatching(/^UALA/),
      tea: expect.any(Number),
      tna: expect.any(Number),
    })

    const fondos = resultado.map(r => r.fondo)
    expect(fondos).toContain('UALA')
  }, {
    timeout: 30000,
  })
})

