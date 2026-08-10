import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearUala } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerUala.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearUala', () => {
  it('devuelve un solo ítem con tasas mínimas y rango en metadata', () => {
    const html = readFileSync(join(fixturesDir, 'uala.html'), 'utf8')
    const ofertas = parsearUala(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'UALA',
      nombreComercial: 'Ualá',
      producto: 'Préstamo personal',
      condiciones: 'Rango según solicitud',
      tna: 0.62,
      tea: 0.8307,
      cftTea: 1.0709,
      metadata: {
        rango: {
          tna: { min: 0.62, max: 1.7 },
          tea: { min: 0.8307, max: 3.9099 },
          cftTea: { min: 1.0709, max: 5.6894 },
        },
      },
    })
  })
})
