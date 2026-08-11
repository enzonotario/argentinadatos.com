import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearPatagonia } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerPatagonia.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearPatagonia', () => {
  it('extrae tasas y un tramo 1–60 meses', () => {
    const html = readFileSync(join(fixturesDir, 'patagonia.html'), 'utf8')
    const ofertas = parsearPatagonia(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'PATAGONIA',
      producto: 'Préstamo personal online',
      tna: 0.98,
      tea: 1.5665,
      cftTea: 2.0978,
      requiereCliente: true,
      condiciones: 'Cartera de consumo',
      vigenciaDesde: '2025-11-13',
      vigenciaHasta: '2026-12-31',
      metadata: {
        plazoMesesEjemplo: 60,
        plazoMinMeses: 1,
        plazoMaxMeses: 60,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 1,
        plazoMaxMeses: 60,
        tna: 0.98,
        tea: 1.5665,
        cftTea: 2.0978,
      },
    ])
  })
})
