import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { extraerInflacionREM } from '@/finanzas/inflacionREM/extraccion/extraerInflacionREM.js'
import { guardarInflacionREM } from '@/finanzas/inflacionREM/guardado/guardarInflacionREM.js'

describe('guardarInflacionREM', () => {
  it('guarda la inflación REM', async () => {
    const items = await extraerInflacionREM()

    expect(items.length).toBeGreaterThan(0)

    const esperado = await guardarInflacionREM(items)

    expect(esperado).toBeDefined()

    const guardado = await leerRuta('/finanzas/inflacion/rem')

    for (const item of items) {
      expect(guardado).toContainEqual(item)
    }
  })
})

