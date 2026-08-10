import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearSupervielle } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerSupervielle.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearSupervielle', () => {
  it('extrae cartera consumo con CFT con/sin IVA', () => {
    const html = readFileSync(join(fixturesDir, 'supervielle.html'), 'utf8')
    const ofertas = parsearSupervielle(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'SUPERVIELLE',
      tna: 1.45,
      tea: 2.935,
      cftTea: 4.1499,
      condiciones: 'Cartera consumo',
      vigenciaDesde: '2026-04-23',
      vigenciaHasta: '2026-06-30',
      metadata: { cftTeaSinIva: 2.935 },
    })
  })
})
