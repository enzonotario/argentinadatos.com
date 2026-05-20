import { describe, expect, it, vi } from 'vitest'

const extraerBcraApi = vi.fn()

vi.mock('@/finanzas/compartido/extraccion/bcra.js', () => ({
  extraerBcraApi,
}))

const { extraerInflacionesInteranual } =
  await import('@/finanzas/indices/inflacion-interanual/extraccion/extraerInflacionesInteranual.js')

describe('extraerInflacionesInteranual', () => {
  it('mapea la serie interanual del BCRA a fecha/valor', async () => {
    extraerBcraApi.mockResolvedValue([
      { fecha: '2023-12-31', valor: 211.4, otroCampo: true },
      { fecha: '2023-11-30', valor: 160.9 },
    ])

    const inflaciones = await extraerInflacionesInteranual(
      '2000-01-01',
      '2023-12-31',
    )

    expect(extraerBcraApi).toHaveBeenCalledWith(28, '2000-01-01', '2023-12-31')
    expect(inflaciones).toEqual([
      { fecha: '2023-12-31', valor: 211.4 },
      { fecha: '2023-11-30', valor: 160.9 },
    ])
  })
})
