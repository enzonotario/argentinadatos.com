import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearPrestamosPersonalesBcra } from '@/finanzas/creditos/prestamos-personales-bcra/extraccion/extraerPrestamosPersonalesBcra.js'
import { guardarPrestamosPersonalesBcra } from '@/finanzas/creditos/prestamos-personales-bcra/guardado/guardarPrestamosPersonalesBcra.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

vi.mock('@/utils/rutas.js', () => ({
  escribirRuta: vi.fn(async (_ruta, items) => items),
  leerRuta: vi.fn(),
}))

describe('guardarPrestamosPersonalesBcra', () => {
  it('persiste las ofertas parseadas del fixture (sin tocar datos reales)', async () => {
    const { escribirRuta } = await import('@/utils/rutas.js')

    const items = parsearPrestamosPersonalesBcra(
      readFileSync(join(fixturesDir, 'personales.csv'), 'latin1'),
    )

    expect(items.length).toBeGreaterThan(0)

    const resultado = await guardarPrestamosPersonalesBcra(items)

    expect(escribirRuta).toHaveBeenCalledWith(
      '/finanzas/creditos/prestamosPersonalesBcra',
      items,
    )
    expect(resultado).toEqual(items)
  })
})
