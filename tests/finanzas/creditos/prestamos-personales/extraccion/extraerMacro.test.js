import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parsearMacroPdf,
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

  it('parsea ejemplos representativos del PDF', () => {
    const texto = readFileSync(join(fixturesDir, 'macro.pdf.txt'), 'utf8')
    const ofertas = parsearMacroPdf(texto)

    expect(ofertas).toHaveLength(5)
    expect(ofertas[0]).toMatchObject({
      entidad: 'MACRO',
      condiciones: 'Plan Sueldo',
      tna: 0.79,
      tea: 1.1492,
      cftTea: 1.5086,
      vigenciaDesde: '2026-05-04',
      metadata: { plazoMesesEjemplo: 60 },
    })
    expect(ofertas.map((o) => o.condiciones)).toEqual([
      'Plan Sueldo',
      'Jubilados',
      'Mercado Abierto y PyN',
      'Selecta',
      'AUH',
    ])
  })
})
