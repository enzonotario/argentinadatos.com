import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearGalicia } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerGalicia.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearGalicia', () => {
  it('extrae Éminent, PLUS y MOVE con tramo 6–72', () => {
    const json = readFileSync(join(fixturesDir, 'galicia.model.json'), 'utf8')
    const ofertas = parsearGalicia(json)

    expect(ofertas).toHaveLength(3)

    expect(ofertas[0]).toMatchObject({
      entidad: 'GALICIA',
      producto: 'Préstamo personal Éminent',
      condiciones: 'Servicio Éminent',
      tna: 0.79,
      tea: 1.1492,
      cftTea: 1.5086,
      requiereCliente: true,
      metadata: {
        plazoMesesEjemplo: 12,
        plazoMinMeses: 6,
        plazoMaxMeses: 72,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 6,
        plazoMaxMeses: 72,
        tna: 0.79,
        tea: 1.1492,
        cftTea: 1.5086,
      },
    ])

    expect(ofertas[1]).toMatchObject({
      producto: 'Préstamo personal PLUS',
      condiciones: 'Servicio PLUS GOLD y PLUS',
      tna: 0.99,
      tea: 1.589,
      cftTea: 2.1324,
    })

    expect(ofertas[2]).toMatchObject({
      producto: 'Préstamo personal MOVE',
      condiciones: 'Servicio MOVE',
      tna: 1.42,
      tea: 2.827,
      cftTea: 3.9819,
    })

    for (const oferta of ofertas) {
      expect(oferta.metadata.tasasPorPlazo).toHaveLength(1)
      expect(oferta.metadata.tasasPorPlazo[0].plazoMinMeses).toBe(6)
      expect(oferta.metadata.tasasPorPlazo[0].plazoMaxMeses).toBe(72)
    }
  })
})
