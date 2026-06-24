import { describe, expect, it } from 'vitest'
import {
  URL_TU_PLAZO_FIJO_HOMEBANKING,
  extraerTuPlazoFijoHomebanking,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerTuPlazoFijo.js'

describe('extraerTuPlazoFijoHomebanking', () => {
  it('extrae tasas por banco y plazo desde TuPlazoFijo homebanking', async () => {
    expect(URL_TU_PLAZO_FIJO_HOMEBANKING).toBe(
      'https://www.tuplazofijo.com.ar/plazos-fijos/tasas/homebanking/',
    )

    const registros = await extraerTuPlazoFijoHomebanking()

    expect(registros.length).toBeGreaterThan(10)

    for (const registro of registros) {
      expect(typeof registro.entidad).toBe('string')
      expect(registro.entidad).not.toBe('')
      expect(Array.isArray(registro.tasas)).toBe(true)
      expect(registro.tasas.length).toBeGreaterThan(0)

      for (const tramo of registro.tasas) {
        expect(typeof tramo.tna).toBe('number')
        expect(tramo.tna).toBeGreaterThan(0)
        expect(tramo.tna).toBeLessThan(1)
        expect(tramo.plazoMinDias).toBe(tramo.plazoMaxDias)
      }
    }

    const galicia = registros.find(
      registro => registro.entidad === 'Banco Galicia',
    )
    const reba = registros.find(registro => registro.entidad === 'Reba')
    const brubank = registros.find(registro => registro.entidad === 'Brubank')

    expect(galicia).toBeDefined()
    expect(reba).toBeDefined()
    expect(brubank).toBeDefined()

    expect(
      galicia.tasas.some(tramo => tramo.plazoMinDias === 60 && tramo.tna > 0),
    ).toBe(true)
    expect(
      galicia.tasas.some(tramo => tramo.plazoMinDias === 365 && tramo.tna > 0),
    ).toBe(true)
    expect(reba.tasas.some(tramo => tramo.plazoMinDias === 30)).toBe(true)
    expect(brubank.enlace).toMatch(/^https:\/\//)
    expect(brubank.logo).toMatch(/^https:\/\//)
  }, 30000)
})
