import { describe, expect, it } from 'vitest'
import {
  extraerBrubankCuentaMax,
  parsearTasasCuentaMaxBrubank,
} from '@/finanzas/fci/otros/extraccion/extraerBrubank.js'

const HTML_FIXTURE = `
<html><body><article>
  <p>Topes de remuneración:</p>
  <p>Remuneración hasta $1.000.000 para cartera general. TNA 19%</p>
  <p>Remuneración hasta $2.000.000 para cartera seleccionada. TNA 22%</p>
  <p>Tasas vigentes al 09/09/2026</p>
</article></body></html>
`

describe('parsearTasasCuentaMaxBrubank', () => {
  it('extrae las tasas de cartera general y seleccionada', () => {
    const tramos = parsearTasasCuentaMaxBrubank(HTML_FIXTURE)

    expect(tramos).toHaveLength(2)
    expect(tramos[0]).toMatchObject({
      fondo: 'BRUBANK CUENTA MAX',
      tna: 0.19,
      tope: 1000000,
    })
    expect(tramos[1]).toMatchObject({
      fondo: 'BRUBANK CUENTA MAX SELECCIONADA',
      tna: 0.22,
      tope: 2000000,
    })
    tramos.forEach(tramo => {
      expect(tramo.tea).toBeGreaterThan(tramo.tna)
      expect(tramo.condicionesCorto).toContain('Cuenta Max')
      expect(tramo.condiciones).toContain('Cuenta Max')
    })
  })

  it('falla si no encuentra la cartera general', () => {
    expect(() => parsearTasasCuentaMaxBrubank('<p>sin tasas</p>')).toThrow()
  })
})

describe.skipIf(import.meta.env.VITE_RUN_AI_TESTS !== 'true')(
  'extraerBrubankCuentaMax',
  () => {
    it('extrae datos reales de la web de Brubank', async () => {
      const resultado = await extraerBrubankCuentaMax()

      expect(resultado.length).toBeGreaterThanOrEqual(1)
      expect(resultado[0].fondo).toBe('BRUBANK CUENTA MAX')
      expect(resultado[0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }, 30000)
  },
)
