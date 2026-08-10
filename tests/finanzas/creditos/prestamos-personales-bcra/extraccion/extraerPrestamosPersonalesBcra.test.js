import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parsearPrestamosPersonalesBcra,
  monedaDesdeDenominacion,
  requiereClienteDeBeneficiario,
  URL_PERSONALES_BCRA,
} from '@/finanzas/creditos/prestamos-personales-bcra/extraccion/extraerPrestamosPersonalesBcra.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const csvLatin1 = readFileSync(join(fixturesDir, 'personales.csv'), 'latin1')

describe('parsearPrestamosPersonalesBcra', () => {
  it('parsea ARS, descarta UVA/USD y normaliza máximos en decimal', () => {
    const items = parsearPrestamosPersonalesBcra(csvLatin1)

    expect(items.every((i) => i.moneda === 'ARS')).toBe(true)
    expect(items).toHaveLength(10)

    const bna = items.find(
      (i) => i.codigoEntidad === '11' && i.productoCorto === 'NACION SUELDOS',
    )

    expect(bna).toMatchObject({
      codigoEntidad: '11',
      entidad: 'BNA',
      nombreComercial: 'BANCO DE LA NACION ARGENTINA',
      teaMax: 0.7286,
      cftTeaMax: 0.9332,
      tipoTasa: 'fija',
      requiereCliente: true,
      enlace: URL_PERSONALES_BCRA,
      metadata: {
        afectacionIngresos: '35%',
        fuente: 'bcra-csv',
        plazoMaxMeses: 72,
      },
    })

    const uala = items.find((i) => i.entidad === 'UALA')
    const mp = items.find((i) => i.entidad === 'MERCADOPAGO')
    const macro = items.filter((i) => i.entidad === 'MACRO')

    expect(uala?.cftTeaMax).toBe(5.6894)
    expect(mp?.cftTeaMax).toBe(13.7594)
    expect(macro).toHaveLength(2)
    expect(items.some((i) => i.moneda === 'UVA')).toBe(false)
    expect(items.some((i) => i.moneda === 'USD')).toBe(false)
  })

  it('permite monedas adicionales vía opciones', () => {
    const items = parsearPrestamosPersonalesBcra(csvLatin1, {
      monedas: ['ARS', 'USD', 'UVA'],
    })

    expect(items.some((i) => i.moneda === 'UVA')).toBe(true)
    expect(items.some((i) => i.moneda === 'USD')).toBe(true)
    expect(items.length).toBeGreaterThan(10)
  })
})

describe('helpers moneda / beneficiario', () => {
  it('mapea denominación a moneda', () => {
    expect(monedaDesdeDenominacion('Pesos')).toBe('ARS')
    expect(monedaDesdeDenominacion('Dólares estadounidenses')).toBe('USD')
    expect(monedaDesdeDenominacion('UVA')).toBe('UVA')
    expect(monedaDesdeDenominacion('')).toBe(null)
  })

  it('infiere requiereCliente desde Beneficiario', () => {
    expect(requiereClienteDeBeneficiario('Todos los beneficiarios')).toBe(false)
    expect(
      requiereClienteDeBeneficiario('Clientes que acrediten sueldos en la entidad'),
    ).toBe(true)
    expect(
      requiereClienteDeBeneficiario('Personas humanas Monotributistas'),
    ).toBe(false)
  })
})
