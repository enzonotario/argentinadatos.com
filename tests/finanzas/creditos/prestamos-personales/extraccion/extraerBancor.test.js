import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearBancor } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBancor.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearBancor', () => {
  it('extrae tasas y un tramo 1–72 meses', () => {
    const html = readFileSync(join(fixturesDir, 'bancor.html'), 'utf8')
    const ofertas = parsearBancor(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'BANCOR',
      producto: 'Préstamo personal Bancón',
      tna: 0.65,
      tea: 0.8837,
      cftTea: 1.1428,
      requiereCliente: true,
      condiciones: 'Cartera de consumo',
      vigenciaDesde: '2026-08-01',
      vigenciaHasta: '2026-08-31',
      metadata: {
        plazoMesesEjemplo: 72,
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
        tna: 0.65,
        tea: 0.8837,
        cftTea: 1.1428,
      },
    ])
  })
})
