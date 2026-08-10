import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearBnaNacionSueldos } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBnaNacionSueldos.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearBnaNacionSueldos', () => {
  it('extrae las tres tablas de Nación Sueldos', () => {
    const html = readFileSync(join(fixturesDir, 'bna-nacion-sueldos.html'), 'utf8')
    const ofertas = parsearBnaNacionSueldos(html)

    expect(ofertas).toHaveLength(3)
    expect(ofertas[0]).toMatchObject({
      producto: 'Nación Sueldos',
      tna: 0.56,
      tea: 0.7286,
      cftTea: 0.9332,
      requiereCliente: true,
      metadata: { afectacionIngresos: '35%' },
    })
    expect(ofertas[1].condiciones).toMatch(/con haberes/i)
    expect(ofertas[2].condiciones).toMatch(/sin haberes/i)
    expect(ofertas[2].requiereCliente).toBe(false)
  })
})
