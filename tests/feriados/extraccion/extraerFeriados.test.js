import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extraerFeriados } from '@/feriados/extraccion/extraerFeriados'

const fetchMock = vi.fn()

describe('extraerFeriados', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('extrae y normaliza feriados desde el HTML', async () => {
    fetchMock.mockResolvedValue({
      text: async () => `
        <div class="holidays-card-calendar">
          <h3 class="com-text">Enero</h3>
          <ul class="holidays-list">
            <li>
              <span class="immovable">1</span>
              <h4 class="com-text">Año nuevo</h4>
            </li>
          </ul>
        </div>
        <div class="holidays-card-calendar">
          <h3 class="com-text">Abril</h3>
          <ul class="holidays-list">
            <li>
              <span class="bridge">1</span>
              <h4 class="com-text">Feriado puente turístico</h4>
            </li>
            <li>
              <span class="transferable">2</span>
              <h4 class="com-text">Malvinas</h4>
            </li>
          </ul>
        </div>
      `,
    })

    const feriados = await extraerFeriados(2024)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.lanacion.com.ar/feriados/2024',
    )
    expect(feriados).toEqual([
      {
        dia: 1,
        mes: 1,
        año: 2024,
        fecha: '2024-01-01',
        tipo: 'inamovible',
        nombre: 'Año nuevo',
      },
      {
        dia: 1,
        mes: 4,
        año: 2024,
        fecha: '2024-04-01',
        tipo: 'puente',
        nombre: 'Feriado puente turístico',
      },
      {
        dia: 2,
        mes: 4,
        año: 2024,
        fecha: '2024-04-02',
        tipo: 'trasladable',
        nombre: 'Malvinas',
      },
    ])
  })
})
