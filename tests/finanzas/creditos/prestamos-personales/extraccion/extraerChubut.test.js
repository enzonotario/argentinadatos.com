import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearChubut } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerChubut.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearChubut', () => {
  it('extrae descuento de haberes con tramo 2–60', () => {
    const json = readFileSync(join(fixturesDir, 'chubut.tasas.json'), 'utf8')
    const ofertas = parsearChubut(json)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'CHUBUT',
      producto: 'Préstamos Personales con Descuento de Haberes',
      tna: 0.725,
      tea: 1.0223,
      cftTea: 1.3328,
      requiereCliente: true,
      vigenciaDesde: '2025-08-26',
      metadata: {
        plazoMinMeses: 2,
        plazoMaxMeses: 60,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 2,
        plazoMaxMeses: 60,
        tna: 0.725,
        tea: 1.0223,
        cftTea: 1.3328,
      },
    ])
  })
})
