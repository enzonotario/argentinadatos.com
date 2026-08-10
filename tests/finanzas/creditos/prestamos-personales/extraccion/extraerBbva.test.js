import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearBbva } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearBbva', () => {
  it('extrae TNA, TEA y CFTEA del HTML', () => {
    const html = readFileSync(join(fixturesDir, 'bbva.html'), 'utf8')
    const ofertas = parsearBbva(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'BBVA',
      tna: 1.29,
      tea: 2.4051,
      cftTea: 3.23,
      requiereCliente: true,
      vigenciaDesde: '2026-08-01',
      vigenciaHasta: '2026-08-31',
    })
  })
})
