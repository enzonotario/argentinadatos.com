import { describe, expect, it, vi } from 'vitest'

const extraerBcraApi = vi.fn()

vi.mock('@/finanzas/compartido/extraccion/bcra.js', () => ({
  extraerBcraApi,
}))

const { extraerInflaciones } =
  await import('@/finanzas/indices/inflacion/extraccion/extraerInflaciones.js')

describe('extraerInflaciones', () => {
  it('mapea la serie del BCRA a fecha/valor', async () => {
    extraerBcraApi.mockResolvedValue([
      { fecha: '2023-12-31', valor: 25.5, detalle: 'ignorar' },
      { fecha: '2023-11-30', valor: 12.8, idVariable: 27 },
    ])

    const inflaciones = await extraerInflaciones('2000-01-01', '2023-12-31')

    expect(extraerBcraApi).toHaveBeenCalledWith(27, '2000-01-01', '2023-12-31')
    expect(inflaciones).toEqual([
      { fecha: '2023-12-31', valor: 25.5 },
      { fecha: '2023-11-30', valor: 12.8 },
    ])
  })
})
