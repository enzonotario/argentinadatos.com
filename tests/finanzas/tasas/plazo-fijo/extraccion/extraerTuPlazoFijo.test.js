import { describe, expect, it } from 'vitest'
import {
  URL_TU_PLAZO_FIJO_HOMEBANKING,
  extraerTuPlazoFijoHomebanking,
  parsearTasasHomebankingTuPlazoFijo,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerTuPlazoFijo.js'

const HTML_V2_TASAS = `
<script>
window.V2_TASAS = {
  moneda: "pesos",
  esUva: false,
  inflacion: 2.1,
  plazoInicial: 30,
  montoInicial: 1000000,
  bancos: [
    {"slug":"rebanking","nombre":"Reba","ini":"RE","tipo":"Digital","tr":"down","t":{"30":24,"60":23,"90":23,"365":23}},
    {"slug":"banco-galicia","nombre":"Banco Galicia","ini":"GA","tipo":"Privado","tr":"down","t":{"30":17.75,"60":16,"90":17,"365":20.5}},
    {"slug":"brubank","nombre":"Brubank","ini":"BR","tipo":"Digital","tr":"down","t":{"30":17,"60":16.5,"90":15.5,"365":13.5}},
    {"slug":"banco-meridian","nombre":"Banco Meridian","ini":"ME","tipo":"Digital","tr":"down","t":{"30":22.5,"60":26,"90":24.5}}
  ]
};
</script>
`

describe('parsearTasasHomebankingTuPlazoFijo', () => {
  it('parsea window.V2_TASAS con tasas por plazo', () => {
    const registros = parsearTasasHomebankingTuPlazoFijo(HTML_V2_TASAS)

    expect(registros).toHaveLength(4)

    const galicia = registros.find(
      registro => registro.entidad === 'Banco Galicia',
    )
    const meridian = registros.find(
      registro => registro.entidad === 'Banco Meridian',
    )
    const brubank = registros.find(registro => registro.entidad === 'Brubank')

    expect(galicia.tasas).toEqual([
      {
        montoMinimo: null,
        montoMaximo: null,
        plazoMinDias: 30,
        plazoMaxDias: 30,
        tna: 0.1775,
      },
      {
        montoMinimo: null,
        montoMaximo: null,
        plazoMinDias: 60,
        plazoMaxDias: 60,
        tna: 0.16,
      },
      {
        montoMinimo: null,
        montoMaximo: null,
        plazoMinDias: 90,
        plazoMaxDias: 90,
        tna: 0.17,
      },
      {
        montoMinimo: null,
        montoMaximo: null,
        plazoMinDias: 365,
        plazoMaxDias: 365,
        tna: 0.205,
      },
    ])
    expect(meridian.tasas.map(tramo => tramo.plazoMinDias)).toEqual([
      30, 60, 90,
    ])
    expect(brubank.enlace).toBe(
      'https://www.tuplazofijo.com.ar/plazos-fijos/bancos/brubank/',
    )
    expect(brubank.logo).toBe(
      'https://www.tuplazofijo.com.ar/img/bancos/brubank-round-65x65.png',
    )
  })

  it('devuelve vacío si no hay V2_TASAS', () => {
    expect(parsearTasasHomebankingTuPlazoFijo('<html></html>')).toEqual([])
    expect(parsearTasasHomebankingTuPlazoFijo('')).toEqual([])
    expect(parsearTasasHomebankingTuPlazoFijo(null)).toEqual([])
  })
})

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
