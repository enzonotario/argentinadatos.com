import { beforeEach, describe, expect, it, vi } from 'vitest'
import { leerRuta } from '@/utils/rutas.esjs'
import { guardarCacfi } from '@/finanzas/fci/guardarCacfi.esjs'
import { format, parseISO } from 'date-fns'

const rutas = vi.hoisted(() => new Map())

vi.mock('@/utils/rutas.esjs', () => ({
  escribirRuta: vi.fn(async (ruta, datos) => {
    rutas.set(ruta, datos)
    return datos
  }),
  leerRuta: vi.fn(ruta => rutas.get(ruta)),
}))

describe('guardarCacfi', () => {
  beforeEach(() => {
    rutas.clear()
  })

  it('guarda las series de Cacfi', async () => {
    const fecha = parseISO('2026-04-16')
    const fechaConBarra = format(fecha, 'yyyy/MM/dd')
    const items = [
      {
        fondo: 'Fondo de prueba',
        horizonte: 'medio',
        fecha: '2026-04-16',
        vcp: 123,
        ccp: 456,
        patrimonio: 789,
      },
    ]

    const series = [
      'mercadoDinero',
      'rentaVariable',
      'rentaFija',
      'rentaMixta',
      'retornoTotal',
    ]

    for (const serie of series) {
      const esperado = await guardarCacfi(serie, items, fecha)

      expect(esperado).toBeDefined()

      const guardado = await leerRuta(`/finanzas/fci/${serie}/${fechaConBarra}`)

      for (const item of items) {
        expect(guardado).toContainEqual(item)
      }
    }
  }, {
    timeout: 1000 * 60 * 5, // 5 minutes
  })
})
