import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearBna } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearBna', () => {
  it('extrae las dos variantes de Nación Destino Libre', () => {
    const html = readFileSync(join(fixturesDir, 'bna.html'), 'utf8')
    const ofertas = parsearBna(html)

    expect(ofertas).toHaveLength(2)

    expect(ofertas[0]).toMatchObject({
      entidad: 'BNA',
      producto: 'Nación Destino Libre',
      tna: 0.74,
      tea: 1.0505,
      cftTna: 1.0426,
      cftTea: 1.7176,
      requiereCliente: true,
      condiciones: 'Con paquete Cuenta Nación',
      metadata: { afectacionIngresos: '30%' },
    })

    expect(ofertas[1]).toMatchObject({
      tna: 0.91,
      tea: 1.404,
      cftTna: 1.1011,
      cftTea: 1.8676,
      requiereCliente: false,
      condiciones: 'Sin paquete Cuenta Nación',
    })
  })
})
