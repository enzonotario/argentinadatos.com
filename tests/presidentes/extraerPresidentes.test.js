import { describe, expect, it } from 'vitest'
import { extraerPresidentes } from '@/presidentes/extraccion/extraerPresidentes.esjs'

describe('extraerPresidentes', () => {
  it('extrae una lista de presidentes', async () => {
    const presidentes = await extraerPresidentes()

    expect(presidentes.length).toBeGreaterThan(0)
  })

  it('cada presidente tiene nombre', async () => {
    const presidentes = await extraerPresidentes()

    for (const presidente of presidentes) {
      expect(presidente.nombre).toBeTruthy()
      expect(typeof presidente.nombre).toBe('string')
    }
  })

  it('las fechas tienen formato yyyy-MM-dd cuando están presentes', async () => {
    const presidentes = await extraerPresidentes()

    for (const presidente of presidentes) {
      if (presidente.inicio !== null) {
        expect(presidente.inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
      if (presidente.fin !== null) {
        expect(presidente.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('incluye presidentes históricos conocidos', async () => {
    const presidentes = await extraerPresidentes()

    const nombres = presidentes.map(p => p.nombre)

    expect(nombres.some(n => n.includes('Perón'))).toBe(true)
    expect(nombres.some(n => n.includes('Kirchner'))).toBe(true)
    expect(nombres.some(n => n.includes('Menem'))).toBe(true)
  })

  it('los presidentes históricos tienen fechas de inicio y fin', async () => {
    const presidentes = await extraerPresidentes()

    const menem = presidentes.find(p => p.nombre.includes('Menem'))
    expect(menem).toBeDefined()
    expect(menem.inicio).toBe('1989-07-08')
  })
})
