import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearMercadoPago } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerMercadoPago.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('parsearMercadoPago', () => {
  it('devuelve un solo ítem con tasas mínimas y rango en metadata', () => {
    const html = readFileSync(join(fixturesDir, 'mercadopago.html'), 'utf8')
    const ofertas = parsearMercadoPago(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'MERCADOPAGO',
      nombreComercial: 'Mercado Pago',
      condiciones: 'Rango según solicitud',
      tna: 0.48,
      tea: 0.6012,
      cftTea: 0.7636,
      metadata: {
        plazoMinDias: 7,
        plazoMaxMeses: 24,
        rango: {
          tna: { min: 0.48, max: 2.49 },
          tea: { min: 0.6012, max: 8.6348 },
          cftTea: { min: 0.7636, max: 13.7594 },
        },
      },
    })
  })
})
