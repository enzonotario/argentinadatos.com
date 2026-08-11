import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parsearBbvaPdf,
  extraerBbva,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js'
import { parsearMacroPdf, extraerMacro } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerMacro.js'
import {
  parsearSantander,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerSantander.js'
import {
  parsearBancor,
  extraerBancor,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBancor.js'
import {
  parsearGalicia,
  extraerGalicia,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerGalicia.js'
import { guardarPrestamosPersonales } from '@/finanzas/creditos/prestamos-personales/guardado/guardarPrestamosPersonales.js'
import { leerRuta } from '@/utils/rutas.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('guardarPrestamosPersonales', () => {
  it('guarda ofertas parseadas desde fixtures', async () => {
    const items = [
      ...parsearBancor(
        readFileSync(join(fixturesDir, 'bancor.html'), 'utf8'),
      ),
      ...parsearBbvaPdf(
        readFileSync(join(fixturesDir, 'bbva.pdf.txt'), 'utf8'),
      ),
      ...parsearGalicia(
        readFileSync(join(fixturesDir, 'galicia.model.json'), 'utf8'),
      ),
      ...parsearMacroPdf(
        readFileSync(join(fixturesDir, 'macro.pdf.txt'), 'utf8'),
      ),
      ...parsearSantander(
        readFileSync(join(fixturesDir, 'santander.html'), 'utf8'),
      ),
    ]

    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.metadata?.tasasPorPlazo?.length > 0)).toBe(
      true,
    )

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
      'extrae ofertas de Bancor, BBVA, Galicia y Macro con tasas por tramo',
      async () => {
        const [bancor, bbva, galicia, macro] = await Promise.all([
          extraerBancor(),
          extraerBbva(),
          extraerGalicia(),
          extraerMacro(),
        ])

        expect(bancor.length).toBeGreaterThanOrEqual(1)
        expect(bbva.length).toBeGreaterThanOrEqual(1)
        expect(galicia.length).toBeGreaterThanOrEqual(3)
        expect(macro.length).toBeGreaterThanOrEqual(1)
        expect(bancor[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(bbva[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(galicia[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(macro[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
      },
      90000,
    )
  },
)
