import { describe, expect, it } from 'vitest'
import { aggregateMercadoHistorico } from '@/finanzas/fci/series/guardarMercadoHistorico.js'

describe('aggregateMercadoHistorico', () => {
  it('suma patrimonio y flujo estimado por fecha y tipo', () => {
    const puntos = aggregateMercadoHistorico({
      alpha: [
        {
          fecha: '2026-08-13',
          categoriaKey: 'mercadoDinero',
          patrimonio: 1000,
          flujoEstimado: 10,
        },
        {
          fecha: '2026-08-14',
          categoriaKey: 'mercadoDinero',
          patrimonio: 1100,
          flujoEstimado: 50,
        },
      ],
      gamma: [
        {
          fecha: '2026-08-14',
          categoria: 'Renta Fija',
          patrimonio: 500,
          flujoEstimado: -20,
        },
      ],
    })

    expect(puntos).toHaveLength(2)
    expect(puntos[0]).toMatchObject({
      fecha: '2026-08-13',
      patrimonio: 1000,
      flujoEstimado: 10,
    })
    expect(puntos[1].patrimonio).toBe(1600)
    expect(puntos[1].flujoEstimado).toBe(30)
    expect(puntos[1].byType.rentaFija.patrimonio).toBe(500)
  })
})
