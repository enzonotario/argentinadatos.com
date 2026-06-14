import { describe, expect, it } from 'vitest'
import { extraerBicaCuentaPositiva } from '@/finanzas/fci/otros/extraccion/extraerBica.js'

const FONDOS_ESPERADOS = [
  'BICA CUENTA POSITIVA 1',
  'BICA CUENTA POSITIVA 2',
  'BICA CUENTA POSITIVA 3',
  'BICA CUENTA POSITIVA 4',
]

describe('extraerBicaCuentaPositiva', () => {
  it('extrae los niveles de Cuenta Positiva desde la web de Banco Bica', async () => {
    const resultado = await extraerBicaCuentaPositiva()

    expect(resultado).toHaveLength(4)

    resultado.forEach((nivel, indice) => {
      expect(nivel.fondo).toBe(FONDOS_ESPERADOS[indice])
      expect(nivel.tna).toBeGreaterThanOrEqual(0)
      expect(nivel.tea).toBeGreaterThanOrEqual(0)
      expect(typeof nivel.tna).toBe('number')
      expect(typeof nivel.tea).toBe('number')
      expect(nivel.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(nivel.condiciones).toContain('Cuenta Positiva de Banco Bica')
      expect(nivel.condicionesCorto).toMatch(/\$[\d.]+/)
    })

    expect(resultado[0].tope).toBeGreaterThan(0)
    expect(resultado[1].tope).toBeGreaterThan(resultado[0].tope)
    expect(resultado[2].tope).toBeGreaterThan(resultado[1].tope)
    expect(resultado[3].tope).toBeNull()

    const teaCalculada = Number(
      ((1 + resultado[0].tna / 365) ** 365 - 1).toFixed(4),
    )

    expect(Math.abs(resultado[0].tea - teaCalculada)).toBeLessThan(0.01)
  }, 15000)
})
