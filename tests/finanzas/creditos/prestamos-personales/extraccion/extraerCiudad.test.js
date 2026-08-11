import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearCiudad } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerCiudad.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearCiudad', () => {
  it('extrae Plan Sueldo, Jubilados y Cliente Fiel (omite Mercado Abierto sin tasas)', () => {
    const html = readFileSync(join(fixturesDir, 'ciudad.html'), 'utf8')
    const ofertas = parsearCiudad(html)

    expect(ofertas).toHaveLength(3)

    expect(ofertas[0]).toMatchObject({
      entidad: 'CIUDAD',
      producto: 'Ciudad Veloz Plan Sueldo',
      condiciones: 'Plan Sueldo',
      tna: 0.7,
      tea: 0.9746,
      cftTea: 1.267,
      requiereCliente: true,
      vigenciaDesde: '2026-06-19',
      vigenciaHasta: '2026-08-31',
      metadata: {
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
        tna: 0.7,
        tea: 0.9746,
        cftTea: 1.267,
      },
    ])

    expect(ofertas[1]).toMatchObject({
      producto: 'Ciudad Veloz Jubilados y Pensionados ANSES',
      condiciones: 'Jubilados y Pensionados ANSES',
      tna: 0.65,
      tea: 0.8833,
      cftTea: 1.1421,
    })

    expect(ofertas[2]).toMatchObject({
      producto: 'Ciudad Veloz Cliente Fiel',
      condiciones: 'Cliente Fiel',
      tna: 0.87,
      tea: 1.3162,
      cftTea: 1.743,
    })
  })
})
