import { describe, expect, it, vi } from 'vitest'

const extraerBcraApi = vi.fn()

vi.mock('@/finanzas/compartido/extraccion/bcra.js', () => ({
  extraerBcraApi,
}))

const { extraerTasasDepositos30Dias } =
  await import('@/finanzas/tasas/depositos-30-dias/extraccion/extraerTasasDepositos30Dias.js')

describe('extraerTasasDepositos30Dias', () => {
  it('mapea la serie de depósitos a 30 días del BCRA', async () => {
    extraerBcraApi.mockResolvedValue([
      { fecha: '2023-12-29', valor: 1.1023 },
      { fecha: '2023-12-28', valor: 1.0987, detalle: 'ignorar' },
    ])

    const items = await extraerTasasDepositos30Dias('2023-01-01', '2024-01-01')

    expect(extraerBcraApi).toHaveBeenCalledWith(12, '2023-01-01', '2024-01-01')
    expect(items).toEqual([
      { fecha: '2023-12-29', valor: 1.1023 },
      { fecha: '2023-12-28', valor: 1.0987 },
    ])
  })
})
