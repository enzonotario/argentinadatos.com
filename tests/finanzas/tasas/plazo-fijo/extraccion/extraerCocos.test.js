import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  mapearCocosPlazoFijo,
  parsearTasasPlazoFijoCocos,
} from '@/finanzas/tasas/plazo-fijo/extraccion/extraerCocos.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('parsearTasasPlazoFijoCocos', () => {
  it('parsea traditional e ignora plazos null', () => {
    const payload = JSON.parse(
      readFileSync(join(fixturesDir, 'cocos-plazo-fijo-rates.json'), 'utf8'),
    )
    const tasas = parsearTasasPlazoFijoCocos(payload)

    expect(tasas.map(t => t.plazoMinDias)).toEqual([30, 60, 90])
    expect(tasas.find(t => t.plazoMinDias === 30)).toMatchObject({
      plazoMaxDias: 30,
      tna: 0.24,
      montoMinimo: null,
      montoMaximo: null,
    })
    expect(tasas.find(t => t.plazoMinDias === 60)?.tna).toBe(0.245)
    expect(tasas.find(t => t.plazoMinDias === 90)?.tna).toBe(0.2475)
  })

  it('devuelve vacío si falta traditional', () => {
    expect(parsearTasasPlazoFijoCocos({})).toEqual([])
    expect(parsearTasasPlazoFijoCocos(null)).toEqual([])
  })
})

describe('mapearCocosPlazoFijo', () => {
  it('arma la fila comparable con TNA 30d como root', () => {
    const payload = JSON.parse(
      readFileSync(join(fixturesDir, 'cocos-plazo-fijo-rates.json'), 'utf8'),
    )
    const item = mapearCocosPlazoFijo(payload)

    expect(item).toMatchObject({
      entidad: 'Cocos',
      tnaClientes: 0.24,
      tnaNoClientes: 0.24,
      enlace: 'https://cocos.capital/',
    })
    expect(item.logo).toContain('cocos.png')
    expect(item.tasas).toHaveLength(3)
  })
})
