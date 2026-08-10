import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearPrestamosPersonalesBcra } from '@/finanzas/creditos/prestamos-personales-bcra/extraccion/extraerPrestamosPersonalesBcra.js'
import { guardarPrestamosPersonalesBcra } from '@/finanzas/creditos/prestamos-personales-bcra/guardado/guardarPrestamosPersonalesBcra.js'
import { leerRuta } from '@/utils/rutas.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('guardarPrestamosPersonalesBcra', () => {
  it('guarda ofertas parseadas desde el fixture CSV', async () => {
    const items = parsearPrestamosPersonalesBcra(
      readFileSync(join(fixturesDir, 'personales.csv'), 'latin1'),
    )

    expect(items.length).toBeGreaterThan(0)

    await guardarPrestamosPersonalesBcra(items)

    const guardado = await leerRuta('/finanzas/creditos/prestamosPersonalesBcra')

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  })
})
