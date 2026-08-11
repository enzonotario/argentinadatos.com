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
import {
  parsearHipotecario,
  extraerHipotecario,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerHipotecario.js'
import {
  parsearCiudad,
  extraerCiudad,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerCiudad.js'
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
      ...parsearCiudad(
        readFileSync(join(fixturesDir, 'ciudad.html'), 'utf8'),
      ),
      ...parsearGalicia(
        readFileSync(join(fixturesDir, 'galicia.model.json'), 'utf8'),
      ),
      ...parsearHipotecario(
        readFileSync(join(fixturesDir, 'hipotecario.html'), 'utf8'),
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
      'extrae ofertas de Bancor, BBVA, Ciudad, Galicia, Hipotecario y Macro con tasas por tramo',
      async () => {
        const [bancor, bbva, ciudad, galicia, hipotecario, macro] =
          await Promise.all([
            extraerBancor(),
            extraerBbva(),
            extraerCiudad(),
            extraerGalicia(),
            extraerHipotecario(),
            extraerMacro(),
          ])

        expect(bancor.length).toBeGreaterThanOrEqual(1)
        expect(bbva.length).toBeGreaterThanOrEqual(1)
        expect(ciudad.length).toBeGreaterThanOrEqual(3)
        expect(galicia.length).toBeGreaterThanOrEqual(3)
        expect(hipotecario.length).toBeGreaterThanOrEqual(1)
        expect(macro.length).toBeGreaterThanOrEqual(1)
        expect(bancor[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(bbva[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(ciudad[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(galicia[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
        expect(hipotecario[0].metadata?.tasasPorPlazo?.length).toBe(3)
        expect(macro[0].metadata?.tasasPorPlazo?.length).toBeGreaterThan(0)
      },
      90000,
    )
  },
)
