import { describe, expect, it } from 'vitest'
import {
  URL_UALA_PLAZO_FIJO,
  extraerUalaPlazoFijo,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerUala.js'

describe('extraerUalaPlazoFijo', () => {
  it('extrae tasas por plazo desde la web de Ualá', async () => {
    expect(URL_UALA_PLAZO_FIJO).toBe(
      'https://www.uala.com.ar/inversiones/plazo-fijo',
    )

    const resultado = await extraerUalaPlazoFijo()

    expect(resultado).toMatchObject({
      entidad: 'UALA',
      enlace: URL_UALA_PLAZO_FIJO,
    })
    expect(Array.isArray(resultado.tasas)).toBe(true)
    expect(resultado.tasas.length).toBeGreaterThanOrEqual(6)

    for (const tramo of resultado.tasas) {
      expect(typeof tramo.tna).toBe('number')
      expect(tramo.tna).toBeGreaterThan(0)
      expect(tramo.tna).toBeLessThan(1)
      expect(tramo.plazoMinDias).toBe(tramo.plazoMaxDias)
      expect(tramo.plazoMinDias).toBeGreaterThan(0)
    }

    const tramo30 = resultado.tasas.find(tramo => tramo.plazoMinDias === 30)
    const tramo365 = resultado.tasas.find(tramo => tramo.plazoMinDias === 365)

    expect(tramo30).toBeDefined()
    expect(tramo365).toBeDefined()
    expect(resultado.tnaClientes).toBe(tramo30.tna)
    expect(resultado.tnaNoClientes).toBe(tramo30.tna)
    expect(tramo365.tna).toBeGreaterThan(tramo30.tna)
  }, 30000)
})
