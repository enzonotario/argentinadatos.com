import { describe, expect, it, vi } from 'vitest'
import { extraerSupervielle } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerSupervielle.esjs'
import * as firecrawl from '@/finanzas/extraccion/firecrawl.esjs'

describe('extraerSupervielle', () => {
  it('extrae datos correctamente de Supervielle', async () => {
    vi.spyOn(firecrawl, 'scrapearConFirecrawl').mockResolvedValue({
      tasa: 4.0,
      tope: 15000,
    })

    const resultado = await extraerSupervielle()

    expect(resultado).toHaveLength(1)
    expect(resultado[0]).toEqual({
      entidad: 'SUPERVIELLE',
      tasa: 4.0,
      tope: 15000,
    })
  })

  it('retorna array vacio si no hay datos', async () => {
    vi.spyOn(firecrawl, 'scrapearConFirecrawl').mockResolvedValue({})

    const resultado = await extraerSupervielle()

    expect(resultado).toEqual([])
  })

  it('retorna array vacio si hay error', async () => {
    vi.spyOn(firecrawl, 'scrapearConFirecrawl').mockRejectedValue(
      new Error('Network error'),
    )

    const resultado = await extraerSupervielle()

    expect(resultado).toEqual([])
  })

  it('retorna array vacio si la tasa no es un numero', async () => {
    vi.spyOn(firecrawl, 'scrapearConFirecrawl').mockResolvedValue({
      tasa: 'invalid',
    })

    const resultado = await extraerSupervielle()

    expect(resultado).toEqual([])
  })
})
