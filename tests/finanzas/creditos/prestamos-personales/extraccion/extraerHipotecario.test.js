import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearHipotecario } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerHipotecario.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearHipotecario', () => {
  it('extrae tramos 10–12, 13–24 y 25–36', () => {
    const html = readFileSync(join(fixturesDir, 'hipotecario.html'), 'utf8')
    const ofertas = parsearHipotecario(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'HIPOTECARIO',
      producto: 'Préstamo con destino libre',
      tna: 1.134,
      tea: 1.9571,
      cftTea: 2.6698,
      requiereCliente: false,
      condiciones: 'Cartera general / Cartera de consumo',
      vigenciaDesde: '2026-05-01',
      vigenciaHasta: '2026-06-30',
      metadata: {
        plazoMesesEjemplo: 12,
        plazoMinMeses: 10,
        plazoMaxMeses: 36,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 10,
        plazoMaxMeses: 12,
        tna: 1.104,
        tea: 1.877,
        cftTea: 2.5518,
      },
      {
        plazoMinMeses: 13,
        plazoMaxMeses: 24,
        tna: 1.124,
        tea: 1.9302,
        cftTea: 2.6301,
      },
      {
        plazoMinMeses: 25,
        plazoMaxMeses: 36,
        tna: 1.134,
        tea: 1.9571,
        cftTea: 2.6698,
      },
    ])
  })
})
