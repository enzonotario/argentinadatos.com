import { describe, expect, it } from 'vitest'
import { extraerFeriadosBancarios } from '@/feriados-bancarios/extraccion/extraerFeriadosBancarios.js'
import { guardarFeriadosBancarios } from '@/feriados-bancarios/guardado/guardarFeriadosBancarios.js'
import { leerRuta } from '@/utils/rutas.js'

describe('guardarFeriadosBancarios', () => {
  it(
    'guarda los feriados bancarios del año',
    async () => {
      const años = [2024, 2025, 2026]

      for (const año of años) {
        const feriados = await extraerFeriadosBancarios(año)

        expect(feriados.length).toBeGreaterThan(0)

        const esperado = await guardarFeriadosBancarios(año, feriados)
        const guardado = await leerRuta(`/feriados-bancarios/${año}`)

        expect(guardado).toEqual(JSON.parse(esperado))
      }
    },
    { timeout: 45000 },
  )
})
