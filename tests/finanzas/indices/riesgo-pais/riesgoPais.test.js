import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()
const store = new Map()

vi.mock('axios', () => ({
  default: {
    get: getMock,
  },
}))

vi.mock('@/utils/rutas.js', () => ({
  leerRuta: vi.fn(ruta => store.get(ruta) ?? []),
  escribirRuta: vi.fn((ruta, payload) => {
    store.set(ruta, payload)
    return payload
  }),
}))

const { extraerRiesgoPais } =
  await import('@/finanzas/indices/riesgo-pais/extraccion/extraerRiesgoPais.js')
const { default: riesgoPais } =
  await import('@/finanzas/indices/riesgo-pais/riesgoPais.comando.js')

describe('riesgoPais', () => {
  beforeEach(() => {
    store.clear()
    getMock.mockReset()
  })

  it('extraer valores', async () => {
    getMock.mockResolvedValue({
      data: [
        ['Fecha', 'Valor'],
        ['27-12-2024', '627'],
        ['26-12-2024', '631'],
        ['23-12-2024', '649'],
      ],
    })

    const items = await extraerRiesgoPais(
      new Date('2024-01-01'),
      new Date('2024-12-31'),
    )

    expect(getMock).toHaveBeenCalledTimes(1)
    expect(items).toEqual([
      { fecha: '2024-12-27', valor: 627 },
      { fecha: '2024-12-26', valor: 631 },
      { fecha: '2024-12-23', valor: 649 },
    ])
  })

  it('comando', async () => {
    getMock.mockResolvedValue({
      data: [
        ['Fecha', 'Valor'],
        ['27-12-2024', '627'],
        ['26-12-2024', '631'],
        ['23-12-2024', '649'],
      ],
    })
    store.set('/finanzas/indices/riesgo-pais', [
      { fecha: '2024-12-20', valor: 671 },
    ])

    const rutasGuardadas = await riesgoPais()

    expect(rutasGuardadas).toEqual([
      '/finanzas/indices/riesgo-pais/ultimo',
      '/finanzas/indices/riesgo-pais',
    ])
    expect(store.get('/finanzas/indices/riesgo-pais/ultimo')).toEqual({
      fecha: '2024-12-27',
      valor: 627,
    })
    expect(store.get('/finanzas/indices/riesgo-pais')).toEqual([
      { fecha: '2024-12-20', valor: 671 },
      { fecha: '2024-12-23', valor: 649 },
      { fecha: '2024-12-26', valor: 631 },
      { fecha: '2024-12-27', valor: 627 },
    ])
  })
})
