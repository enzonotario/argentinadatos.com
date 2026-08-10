import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearBna, extraerBna } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js'
import { parsearBbva, extraerBbva } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js'
import {
  parsearSupervielle,
  extraerSupervielle,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerSupervielle.js'
import { guardarPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/guardado/guardarPrestamosPersonales.js'
import { leerRuta } from '@/utils/rutas.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('guardarPrestamosPersonales', () => {
  it('guarda ofertas parseadas desde fixtures', async () => {
    const items = [
      ...parsearBna(readFileSync(join(fixturesDir, 'bna.html'), 'utf8')),
      ...parsearBbva(readFileSync(join(fixturesDir, 'bbva.html'), 'utf8')),
      ...parsearSupervielle(
        readFileSync(join(fixturesDir, 'supervielle.html'), 'utf8'),
      ),
    ]

    expect(items.length).toBeGreaterThan(0)

    await guardarPrestamosPersonales(items)

    const guardado = await leerRuta('/finanzas/creditos/prestamosPersonales')

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  })
})

describe.skipIf(process.env.SKIP_NETWORK === '1')(
  'extractores de red (préstamos personales)',
  () => {
    it(
      'extrae al menos una oferta de BNA, BBVA y Supervielle',
      async () => {
        const [bna, bbva, supervielle] = await Promise.all([
          extraerBna(),
          extraerBbva(),
          extraerSupervielle(),
        ])

        expect(bna.length).toBeGreaterThanOrEqual(1)
        expect(bbva.length).toBeGreaterThanOrEqual(1)
        expect(supervielle.length).toBeGreaterThanOrEqual(1)
      },
      60000,
    )
  },
)
