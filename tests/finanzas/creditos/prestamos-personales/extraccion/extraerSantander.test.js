import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearSantander } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerSantander.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearSantander', () => {
  it('extrae CFTEA, TNA y TEA', () => {
    const html = readFileSync(join(fixturesDir, 'santander.html'), 'utf8')
    const ofertas = parsearSantander(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'SANTANDER',
      tna: 0.79,
      tea: 1.1492,
      cftTea: 1.5086,
    })
  })
})
