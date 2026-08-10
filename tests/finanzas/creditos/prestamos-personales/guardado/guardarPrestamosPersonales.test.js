import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearBna, extraerBna } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBna.js'
import { parsearBnaNacionSueldos, extraerBnaNacionSueldos } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBnaNacionSueldos.js'
import { parsearBbva, extraerBbva } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js'
import { parsearGalicia, extraerGalicia } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerGalicia.js'
import { parsearMacroPdf, extraerMacro } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerMacro.js'
import { parsearSantander } from '@/finanzas/creditos/prestamos-personales/extraccion/extraerSantander.js'
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
      ...parsearBnaNacionSueldos(
        readFileSync(join(fixturesDir, 'bna-nacion-sueldos.html'), 'utf8'),
      ),
      ...parsearBbva(readFileSync(join(fixturesDir, 'bbva.html'), 'utf8')),
      ...parsearGalicia(
        readFileSync(join(fixturesDir, 'galicia.model.json'), 'utf8'),
      ),
      ...parsearMacroPdf(
        readFileSync(join(fixturesDir, 'macro.pdf.txt'), 'utf8'),
      ),
      ...parsearSantander(
        readFileSync(join(fixturesDir, 'santander.html'), 'utf8'),
      ),
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
      'extrae ofertas de bancos alcanzables por HTTP',
      async () => {
        const [bna, bnaSueldos, bbva, galicia, macro, supervielle] =
          await Promise.all([
            extraerBna(),
            extraerBnaNacionSueldos(),
            extraerBbva(),
            extraerGalicia(),
            extraerMacro(),
            extraerSupervielle(),
          ])

        expect(bna.length).toBeGreaterThanOrEqual(1)
        expect(bnaSueldos.length).toBeGreaterThanOrEqual(1)
        expect(bbva.length).toBeGreaterThanOrEqual(1)
        expect(galicia.length).toBeGreaterThanOrEqual(1)
        expect(macro.length).toBeGreaterThanOrEqual(1)
        expect(supervielle.length).toBeGreaterThanOrEqual(1)
      },
      90000,
    )
  },
)
