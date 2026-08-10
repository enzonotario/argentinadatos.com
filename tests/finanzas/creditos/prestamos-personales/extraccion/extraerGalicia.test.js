import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearGalicia } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerGalicia.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearGalicia', () => {
  it('extrae Éminent, PLUS y MOVE desde el model.json', () => {
    const json = readFileSync(join(fixturesDir, 'galicia.model.json'), 'utf8')
    const ofertas = parsearGalicia(json)

    expect(ofertas).toHaveLength(3)
    expect(ofertas[0]).toMatchObject({
      entidad: 'GALICIA',
      condiciones: 'Servicio Éminent',
      tna: 0.79,
      tea: 1.1492,
      cftTea: 1.5086,
      requiereCliente: true,
    })
    expect(ofertas[1]).toMatchObject({
      condiciones: 'Servicio PLUS GOLD y PLUS',
      tna: 0.99,
      cftTea: 2.1324,
    })
    expect(ofertas[2]).toMatchObject({
      condiciones: 'Servicio MOVE',
      tna: 1.42,
      cftTea: 3.9819,
    })
  })
})
