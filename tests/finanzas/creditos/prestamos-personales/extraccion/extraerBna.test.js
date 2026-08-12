import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parsearBnaDestinoLibre,
  parsearBnaNacionSueldos,
  parsearBnaNacionPrevisional,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearBnaNacionSueldos', () => {
  it('extrae las tres tablas con tramo 1–72', () => {
    const html = readFileSync(
      join(fixturesDir, 'bna-nacion-sueldos.html'),
      'utf8',
    )
    const ofertas = parsearBnaNacionSueldos(html)

    expect(ofertas).toHaveLength(3)
    expect(ofertas[0]).toMatchObject({
      entidad: 'BNA',
      producto: 'Nación Sueldos',
      tna: 0.56,
      tea: 0.7286,
      cftTna: 0.6776,
      cftTea: 0.9332,
      requiereCliente: true,
      condiciones: 'Haberes en BNA · Convenios generales',
      metadata: {
        afectacionIngresos: '35%',
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
        plazoMesesEjemplo: 72,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
        tna: 0.56,
        tea: 0.7286,
        cftTea: 0.9332,
      },
    ])
    expect(ofertas[1].condiciones).toMatch(/con haberes/i)
    expect(ofertas[1]).toMatchObject({
      tna: 0.64,
      tea: 0.8655,
      cftTea: 1.1179,
      requiereCliente: true,
    })
    expect(ofertas[2].condiciones).toMatch(/sin haberes/i)
    expect(ofertas[2]).toMatchObject({
      tna: 0.72,
      tea: 1.0122,
      cftTea: 1.3187,
      requiereCliente: false,
    })
  })
})

describe('parsearBnaDestinoLibre', () => {
  it('extrae con/sin Cuenta Nación con tramo 1–72', () => {
    const html = readFileSync(
      join(fixturesDir, 'bna-destino-libre.html'),
      'utf8',
    )
    const ofertas = parsearBnaDestinoLibre(html)

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
      metadata: {
        afectacionIngresos: '30%',
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
      },
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

describe('parsearBnaNacionPrevisional', () => {
  it('extrae e@descuento (36) y débito en cuenta (72) con la misma tasa', () => {
    const html = readFileSync(
      join(fixturesDir, 'bna-nacion-previsional.html'),
      'utf8',
    )
    const ofertas = parsearBnaNacionPrevisional(html)

    expect(ofertas).toHaveLength(2)
    expect(ofertas[0]).toMatchObject({
      entidad: 'BNA',
      producto: 'Nación Previsional BNA',
      tna: 0.56,
      tea: 0.7292,
      cftTna: 0.6777,
      cftTea: 0.9332,
      requiereCliente: true,
      condiciones: 'Jubilados con e@descuento obligatorio',
      metadata: {
        plazoMinMeses: 1,
        plazoMaxMeses: 36,
        plazoMesesEjemplo: 36,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toEqual([
      {
        plazoMinMeses: 1,
        plazoMaxMeses: 36,
        tna: 0.56,
        tea: 0.7292,
        cftTea: 0.9332,
      },
    ])
    expect(ofertas[1]).toMatchObject({
      condiciones: 'Jubilados con débito en cuenta',
      metadata: {
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
        plazoMesesEjemplo: 72,
      },
    })
  })
})
