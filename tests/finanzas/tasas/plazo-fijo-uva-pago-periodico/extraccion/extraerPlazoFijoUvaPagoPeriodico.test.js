import { describe, expect, it } from 'vitest'
import {
  extraerPlazoFijoUvaPagoPeriodico,
  parsearTasasUvaPagoPeriodicoDesdeMarkdown,
} from '@/finanzas/tasas/plazo-fijo-uva-pago-periodico/extraccion/extraerPlazoFijoUvaPagoPeriodico.js'

describe('parsearTasasUvaPagoPeriodicoDesdeMarkdown', () => {
  it('parsea la tabla UVA subperíodos del markdown Defuddle', () => {
    const markdown = `
## Tasas

<table><thead><tr><th colspan="3">PLAZO FIJO PRECANCELABLE en UNIDADES DE VALOR ADQUISITIVO ("UVA")</th></tr></thead><tbody><tr><td><b>Rango de Plazo (días)</b></td><td><b>TNA</b></td><td><b>TEA</b></td></tr><tr><td>De 90 a 119</td><td>0,50%</td><td>0,50%</td></tr></tbody></table>

<table><thead><tr><th colspan="3">PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS</th></tr><tr><th colspan="3">PERSONAS HUMANAS (Canales Ventanilla, Electrónico)</th></tr></thead><tbody><tr><td><b>Rango de Plazo (días)</b></td><td><b>TNA</b></td><td><b>TEA</b></td></tr><tr><td>De 90 a 119</td><td>0,25%</td><td>0,25%</td></tr><tr><td>De 120 a 179</td><td>0,50%</td><td>0,50%</td></tr><tr><td>De 900 a 1095</td><td>4,00%</td><td>3,89%</td></tr></tbody></table>
`

    const tasas = parsearTasasUvaPagoPeriodicoDesdeMarkdown(markdown)

    expect(tasas).toHaveLength(3)
    expect(tasas[0]).toMatchObject({
      nombre: 'PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS',
      plazoMinDias: 90,
      plazoMaxDias: 119,
      tna: 0.0025,
      tea: 0.0025,
    })
    expect(tasas[2]).toMatchObject({
      plazoMinDias: 900,
      plazoMaxDias: 1095,
    })
    expect(tasas[2].tna).toBeCloseTo(0.04, 6)
    expect(tasas[2].tea).toBeCloseTo(0.0389, 6)
  })
})

describe('extraerPlazoFijoUvaPagoPeriodico', () => {
  it(
    'extrae proveedores con tasas por plazo (UVA pago periódico)',
    async () => {
      const proveedores = await extraerPlazoFijoUvaPagoPeriodico()

      expect(proveedores).toBeInstanceOf(Array)
      expect(proveedores.length).toBeGreaterThan(0)

      const bna = proveedores.find(p => p.id === 'bna')
      expect(bna).toBeDefined()
      expect(bna).toMatchObject({
        id: 'bna',
        entidad: expect.any(String),
        logo: expect.any(String),
        tasas: expect.any(Array),
      })
      expect(bna.entidad).toBe('Banco de la Nación Argentina')
      expect(bna.tasas.length).toBeGreaterThan(0)

      for (const tasa of bna.tasas) {
        expect(tasa).toMatchObject({
          nombre: expect.any(String),
          plazoMinDias: expect.any(Number),
          plazoMaxDias: expect.any(Number),
        })
        expect(tasa.plazoMinDias).toBeGreaterThan(0)
        expect(tasa.plazoMaxDias).toBeGreaterThanOrEqual(tasa.plazoMinDias)
        expect(typeof tasa.tna).toBe('number')
        expect(typeof tasa.tea).toBe('number')
        expect(tasa.tna).toBeGreaterThan(0)
        expect(tasa.tea).toBeGreaterThan(0)
      }
    },
    {
      timeout: 30000,
    },
  )
})
