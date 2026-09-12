import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  URL_MACRO_PLAZO_FIJO,
  enriquecerPlazoFijoConMacro,
  extraerMacroPlazoFijo,
  parsearLimitesMontoMacroPlazoFijo,
  parsearMacroPlazoFijoPdf,
  resolverUrlPdfMacroPlazoFijo,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerMacro.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('resolverUrlPdfMacroPlazoFijo', () => {
  it('resuelve el link Conocer tasas', () => {
    const html = readFileSync(join(fixturesDir, 'macro-plazo-fijo.html'), 'utf8')

    expect(resolverUrlPdfMacroPlazoFijo(html)).toBe(
      'https://www.macro.com.ar/1517360615001',
    )
  })
})

describe('parsearMacroPlazoFijoPdf', () => {
  const texto = readFileSync(
    join(fixturesDir, 'macro-plazo-fijo.pdf.txt'),
    'utf8',
  )

  it('parsea límites de monto del PDF', () => {
    expect(parsearLimitesMontoMacroPlazoFijo(texto)).toEqual({
      montoHasta: 4999999.99,
      montoDesdeMasDe: 5000000,
    })
  })

  it('parsea tramos Banca Internet/App en pesos por monto y plazo', () => {
    const detalle = parsearMacroPlazoFijoPdf(texto)

    expect(detalle).not.toBeNull()
    expect(detalle.tasas).toHaveLength(16)
    expect(detalle.condicionesCorto).toBe('App / Banca Internet')

    const hasta = detalle.tasas.filter(tramo => tramo.montoMaximo === 4999999.99)
    const masDe = detalle.tasas.filter(tramo => tramo.montoMinimo === 5000000)

    expect(hasta).toHaveLength(8)
    expect(masDe).toHaveLength(8)

    expect(hasta[0]).toEqual({
      montoMinimo: 1,
      montoMaximo: 4999999.99,
      plazoMinDias: 30,
      plazoMaxDias: 35,
      tna: 0.195,
    })
    expect(hasta.find(tramo => tramo.plazoMinDias === 60)).toMatchObject({
      plazoMaxDias: 89,
      tna: 0.2,
    })
    expect(hasta.find(tramo => tramo.plazoMinDias === 271)).toMatchObject({
      plazoMaxDias: 365,
      tna: 0.215,
    })

    expect(masDe[0]).toEqual({
      montoMinimo: 5000000,
      montoMaximo: null,
      plazoMinDias: 30,
      plazoMaxDias: 35,
      tna: 0.2,
    })
    expect(masDe.find(tramo => tramo.plazoMinDias === 271)).toMatchObject({
      plazoMaxDias: 365,
      tna: 0.22,
    })

    // No debe colarse pizarra sucursal (18.25%) ni dólares.
    expect(detalle.tasas.every(tramo => tramo.tna >= 0.195)).toBe(true)
    expect(detalle.tasas.every(tramo => tramo.tna <= 0.22)).toBe(true)
  })
})

describe('enriquecerPlazoFijoConMacro', () => {
  it('enriquece BANCO MACRO S.A. y deja el resto intacto', () => {
    const detalle = parsearMacroPlazoFijoPdf(
      readFileSync(join(fixturesDir, 'macro-plazo-fijo.pdf.txt'), 'utf8'),
    )

    const items = enriquecerPlazoFijoConMacro(
      [
        {
          entidad: 'BANCO MACRO S.A.',
          tnaClientes: 0.1,
          tnaNoClientes: 0,
          enlace: null,
        },
        {
          entidad: 'BANCO DE GALICIA Y BUENOS AIRES S.A.',
          tnaClientes: 0.2,
        },
      ],
      detalle,
    )

    expect(items[0].tasas).toHaveLength(16)
    expect(items[0].tnaClientes).toBe(0.195)
    expect(items[0].enlace).toBe(URL_MACRO_PLAZO_FIJO)
    expect(items[1].tasas).toBeUndefined()
  })
})

describe('extraerMacroPlazoFijo', () => {
  it(
    'extrae tasas vigentes desde el PDF oficial de Macro',
    async () => {
      const detalle = await extraerMacroPlazoFijo()

      expect(detalle).not.toBeNull()
      expect(detalle.tasas.length).toBeGreaterThanOrEqual(8)

      for (const tramo of detalle.tasas) {
        expect(typeof tramo.tna).toBe('number')
        expect(tramo.tna).toBeGreaterThan(0.05)
        expect(tramo.tna).toBeLessThan(1)
        expect(typeof tramo.plazoMinDias).toBe('number')
      }

      expect(
        detalle.tasas.some(
          tramo => tramo.plazoMinDias === 30 && tramo.montoMinimo === 1,
        ),
      ).toBe(true)
      expect(detalle.tasas.some(tramo => tramo.montoMaximo === null)).toBe(true)
    },
    60000,
  )
})
