import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parsearMacroPdf,
  parsearTablasMacroPdf,
  resolverUrlPdfMacro,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerMacro.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('extraerMacro', () => {
  it('resuelve el link Consultá las tasas vigentes', () => {
    const html = readFileSync(join(fixturesDir, 'macro.html'), 'utf8')
    expect(resolverUrlPdfMacro(html)).toContain(
      'tasas-de-prestamos-y-descubiertos-en-cuenta-corriente.pdf',
    )
  })

  it('parsea tablas por plazo del PDF', () => {
    const texto = readFileSync(join(fixturesDir, 'macro.pdf.txt'), 'utf8').replace(
      /\s+/g,
      ' ',
    )
    const tablas = parsearTablasMacroPdf(texto)

    expect(tablas.get('Plan Sueldo')).toHaveLength(7)
    expect(tablas.get('Plan Sueldo')[0]).toMatchObject({
      plazoMinMeses: 1,
      plazoMaxMeses: 12,
      tna: 0.61,
      tea: 0.813,
      cftTea: 1.0468,
    })
    expect(tablas.get('Plan Sueldo')[5]).toMatchObject({
      plazoMinMeses: 49,
      plazoMaxMeses: 60,
      tna: 0.79,
      cftTea: 1.5086,
    })
    expect(tablas.get('Jubilados')[0].tna).toBe(0.55)
    expect(tablas.get('Mercado Abierto y PyN')).toHaveLength(7)
    expect(tablas.get('Renta Presunta')).toHaveLength(4)
    expect(tablas.get('Renta Presunta')[3]).toMatchObject({
      plazoMinMeses: 25,
      plazoMaxMeses: 36,
      tna: 1.25,
    })
    expect(tablas.get('Selecta')).toHaveLength(7)
    expect(tablas.get('AUH')).toHaveLength(1)
    expect(tablas.get('AUH')[0]).toMatchObject({
      plazoMinMeses: 1,
      plazoMaxMeses: 12,
      tna: 0.66,
      cftTea: 1.1666,
    })
  })

  it('parsea ejemplos y adjunta tasasPorPlazo por segmento', () => {
    const texto = readFileSync(join(fixturesDir, 'macro.pdf.txt'), 'utf8')
    const ofertas = parsearMacroPdf(texto)

    expect(ofertas).toHaveLength(6)
    expect(ofertas.map((o) => o.condiciones)).toEqual([
      'Plan Sueldo',
      'Jubilados',
      'Mercado Abierto y PyN',
      'Renta Presunta',
      'Selecta',
      'AUH',
    ])

    expect(ofertas[0]).toMatchObject({
      entidad: 'MACRO',
      condiciones: 'Plan Sueldo',
      tna: 0.79,
      tea: 1.1492,
      cftTea: 1.5086,
      vigenciaDesde: '2026-05-04',
      metadata: {
        plazoMesesEjemplo: 60,
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
        fuentePdf: true,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toHaveLength(7)
    expect(ofertas[0].metadata.tasasPorPlazo[0]).toMatchObject({
      plazoMinMeses: 1,
      plazoMaxMeses: 12,
      tna: 0.61,
    })

    expect(ofertas[3]).toMatchObject({
      condiciones: 'Renta Presunta',
      requiereCliente: false,
      metadata: {
        plazoMinMeses: 1,
        plazoMaxMeses: 36,
      },
    })
    expect(ofertas[3].metadata.plazoMesesEjemplo).toBeUndefined()
    expect(ofertas[3].tna).toBe(1.25)

    expect(ofertas[5]).toMatchObject({
      condiciones: 'AUH',
      tna: 0.66,
      metadata: {
        plazoMesesEjemplo: 12,
        plazoMinMeses: 1,
        plazoMaxMeses: 12,
      },
    })
    expect(ofertas[5].metadata.tasasPorPlazo).toHaveLength(1)
  })
})
