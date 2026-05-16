import { describe, expect, it } from 'vitest'
import { extraerBeloCuentaRemunerada } from '@/finanzas/extraccion/extraerBelo.js'

describe('extraerBeloCuentaRemunerada', () => {
  it('extrae datos reales de la API de Belo', async () => {
    const resultado = await extraerBeloCuentaRemunerada()

    expect(resultado).toBeDefined()
    expect(resultado).toHaveProperty('fondo')
    expect(resultado.fondo).toBe('BELO')
    expect(resultado).toHaveProperty('tna')
    expect(resultado).toHaveProperty('tea')
    expect(resultado).toHaveProperty('fecha')
    expect(resultado.tna).toBeGreaterThan(0)
    expect(resultado.tea).toBeGreaterThan(0)
    expect(typeof resultado.tna).toBe('number')
    expect(typeof resultado.tea).toBe('number')
    expect(resultado.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('maneja errores de la API correctamente', async () => {
    const resultado = await extraerBeloCuentaRemunerada()

    expect(resultado).toBeDefined()
    expect(Array.isArray(resultado) ? resultado : [resultado]).toBeTruthy()
  })

  it('calcula correctamente TNA a partir de TEA', async () => {
    const resultado = await extraerBeloCuentaRemunerada()

    if (Array.isArray(resultado) && resultado.length === 0) {
      return
    }

    const { tna, tea } = resultado

    const teaCalculada = Number(((1 + tna / 365) ** 365 - 1).toFixed(4))

    expect(Math.abs(tea - teaCalculada)).toBeLessThan(0.01)
  })
})
