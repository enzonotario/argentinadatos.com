import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseTasaComisionTexto,
  calcularTasaAnualEquivalente,
  crearComisionBroker,
  PRODUCTOS_BROKER,
  normalizarProducto,
  productosDesdeConcepto,
} from '@/finanzas/brokers/comisiones/extraccion/parseComisionBroker.js'
import { parsearIol } from '@/finanzas/brokers/comisiones/extraccion/extraerIol.js'
import { parsearBalanz } from '@/finanzas/brokers/comisiones/extraccion/extraerBalanz.js'
import {
  parsearBullPdfTexto,
  resolverUrlPdfBull,
} from '@/finanzas/brokers/comisiones/extraccion/extraerBullMarket.js'
import { parsearCocos } from '@/finanzas/brokers/comisiones/extraccion/extraerCocos.js'
import { parsearPpi } from '@/finanzas/brokers/comisiones/extraccion/extraerPpi.js'
import { parsearFiwind } from '@/finanzas/brokers/comisiones/extraccion/extraerFiwind.js'
import { parsearIebMas } from '@/finanzas/brokers/comisiones/extraccion/extraerIebMas.js'
import { parsearEcoValores } from '@/finanzas/brokers/comisiones/extraccion/extraerEcoValores.js'
import { parsearMacroSecuritiesTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerMacroSecurities.js'
import { parsearPuenteTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerPuente.js'
import { parsearAllariaTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerAllaria.js'
import { parsearGaliciaSecurities } from '@/finanzas/brokers/comisiones/extraccion/extraerGaliciaSecurities.js'
import { parsearRava } from '@/finanzas/brokers/comisiones/extraccion/extraerRava.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('catálogo producto', () => {
  it('normaliza labels de tarifario al slug estable', () => {
    expect(normalizarProducto('Caución colocadora')).toBe('cauciones')
    expect(normalizarProducto('Compra / venta de cedears')).toBe('cedears')
    expect(normalizarProducto('Títulos Públicos')).toBe('bonos')
    expect(normalizarProducto('ON, Fid. Financieros')).toBe(
      'obligaciones_negociables',
    )
    expect(normalizarProducto('Alquiler de Títulos')).toBe('alquiler_titulos')
    expect(normalizarProducto('Echeqs / CPD')).toBe('cheques')
    expect(PRODUCTOS_BROKER).toContain('licitaciones')
    expect(PRODUCTOS_BROKER).not.toContain('abono')
  })

  it('expande conceptos unificados a varios productos', () => {
    expect(
      productosDesdeConcepto('Acciones, Bonos, CEDEARs, ONs y Opciones'),
    ).toEqual([
      'cedears',
      'obligaciones_negociables',
      'bonos',
      'acciones',
      'opciones',
    ])
    expect(productosDesdeConcepto('Licitación de Letras')).toEqual([
      'licitaciones',
    ])
  })
})

describe('parseTasaComisionTexto', () => {
  it('parsea tasa mensual y tope con IVA', () => {
    expect(parseTasaComisionTexto('0,15%')).toMatchObject({
      tasa: 0.0015,
      tasaEsTope: false,
    })
    expect(parseTasaComisionTexto('Hasta 0.50% + IVA anual')).toMatchObject({
      tasa: 0.005,
      tasaEsTope: true,
      ivaAdicional: true,
      tasaBaseHint: 'anual',
    })
    expect(parseTasaComisionTexto('2,0% TNA')).toMatchObject({
      tasa: 0.02,
      tasaBaseHint: 'tna',
    })
  })

  it('calcula tasa anual equivalente', () => {
    expect(calcularTasaAnualEquivalente(0.0015, 'mensual')).toBe(0.018)
    expect(calcularTasaAnualEquivalente(0.02, 'tna')).toBe(0.02)
  })
})

describe('parsearIol', () => {
  it('extrae cauciones por plan gold/platinum/black', () => {
    const html = readFileSync(join(fixturesDir, 'iol-tarifas.html'), 'utf8')
    const filas = parsearIol(html)

    expect(filas.length).toBeGreaterThanOrEqual(12)

    const goldArs = filas.find(
      (f) =>
        f.producto === 'cauciones' &&
        f.operacion === 'colocadora' &&
        f.moneda === 'ARS' &&
        f.plan === 'gold',
    )
    expect(goldArs).toMatchObject({
      entidad: 'iol',
      tasa: 0.0015,
      tasaBase: 'mensual',
      tasaAnualEquivalente: 0.018,
      prorrateoDias: 90,
      derechoMercado: 0.00045,
    })

    const tomadoraUsd = filas.find(
      (f) =>
        f.producto === 'cauciones' &&
        f.operacion === 'tomadora' &&
        f.moneda === 'USD' &&
        f.plan === 'gold',
    )
    expect(tomadoraUsd).toMatchObject({
      tasa: 0.003,
      tasaAnualEquivalente: 0.036,
    })
  })

  it('expande acciones/bonos/cedears/ons/opciones por plan', () => {
    const html = readFileSync(join(fixturesDir, 'iol-tarifas.html'), 'utf8')
    const filas = parsearIol(html)

    const goldAcciones = filas.find(
      (f) =>
        f.producto === 'acciones' && f.plan === 'gold' && f.operacion === 'ambas',
    )
    expect(goldAcciones).toMatchObject({
      tasa: 0.005,
      derechoMercado: 0.0005,
    })

    expect(
      filas.some((f) => f.producto === 'cedears' && f.plan === 'black'),
    ).toBe(true)
    expect(filas.some((f) => f.producto === 'letras')).toBe(true)
    expect(filas.some((f) => f.producto === 'cheques')).toBe(true)
    expect(filas.some((f) => f.producto === 'licitaciones')).toBe(true)
  })
})

describe('parsearBalanz', () => {
  it('emite cauciones y otros productos del tarifario', () => {
    const html = readFileSync(
      join(fixturesDir, 'balanz-comisiones.html'),
      'utf8',
    )
    const filas = parsearBalanz(html)

    expect(filas.find((f) => f.producto === 'cauciones' && f.moneda === 'ARS')).toMatchObject({
      entidad: 'balanz',
      operacion: 'ambas',
      tasa: 0.005,
      tasaEsTope: true,
      prorrateoDias: 90,
    })
    expect(filas.find((f) => f.producto === 'cauciones' && f.moneda === 'USD')).toMatchObject({
      tasa: 0.001,
      tasaEsTope: true,
    })

    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      tasa: 0.005,
      tasaEsTope: true,
      operacion: 'ambas',
    })
    expect(filas.find((f) => f.producto === 'cedears')).toBeTruthy()
    expect(filas.find((f) => f.producto === 'bonos')).toBeTruthy()
    expect(filas.find((f) => f.producto === 'obligaciones_negociables')).toBeTruthy()
    expect(filas.find((f) => f.producto === 'opciones')).toBeTruthy()
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.0015,
    })
    expect(filas.find((f) => f.producto === 'cheques')).toBeTruthy()
    expect(filas.filter((f) => f.producto === 'licitaciones').length).toBeGreaterThanOrEqual(1)

    const letraCompraUsd = filas.find(
      (f) =>
        f.producto === 'letras' &&
        f.operacion === 'compra' &&
        f.moneda === 'USD',
    )
    expect(letraCompraUsd).toMatchObject({ tasa: 0.001 })
  })
})

describe('parsearBullPdfTexto', () => {
  it('extrae cauciones, alquiler, cheques y licitaciones', () => {
    const texto = readFileSync(
      join(fixturesDir, 'bull-aranceles.txt'),
      'utf8',
    )
    const filas = parsearBullPdfTexto(texto)

    expect(filas.find((f) => f.producto === 'cauciones' && f.operacion === 'colocadora')).toMatchObject({
      entidad: 'bullmarket',
      tasa: 0.00083,
      tasaBase: 'mensual',
      tasaAnualEquivalente: 0.00996,
      derechoMercado: 0.00045,
    })
    expect(filas.find((f) => f.producto === 'cauciones' && f.operacion === 'tomadora')).toMatchObject({
      tasa: 0.005,
      comisionMinima: 60,
    })
    expect(filas.find((f) => f.producto === 'alquiler_titulos' && f.operacion === 'colocadora')).toMatchObject({
      tasa: 0.00083,
      comisionMinima: 60,
    })
    expect(filas.find((f) => f.producto === 'cheques' && f.operacion === 'compra')).toMatchObject({
      tasa: 0.00083,
      comisionMinima: 100,
    })
    expect(filas.find((f) => f.producto === 'cheques' && f.operacion === 'venta')).toMatchObject({
      tasa: 0.00166,
    })
    expect(filas.filter((f) => f.producto === 'licitaciones').length).toBeGreaterThanOrEqual(1)
  })

  it('resuelve PDF desde HTML de help', () => {
    const html = readFileSync(join(fixturesDir, 'bull-help.html'), 'utf8')
    expect(resolverUrlPdfBull(html)).toMatch(/\.pdf$/i)
  })
})

describe('parsearCocos', () => {
  it('toma columna web/app personas humanas en varios productos', () => {
    const html = readFileSync(
      join(fixturesDir, 'cocos-tarifario.html'),
      'utf8',
    )
    const filas = parsearCocos(html)

    expect(filas.find((f) => f.producto === 'cauciones' && f.operacion === 'colocadora')).toMatchObject({
      entidad: 'cocos',
      plan: 'personas_humanas',
      tasa: 0.02,
      tasaBase: 'tna',
      tasaAnualEquivalente: 0.02,
      canal: 'web',
    })
    expect(filas.find((f) => f.producto === 'cauciones' && f.operacion === 'tomadora')).toMatchObject({
      tasa: 0.1,
      tasaBase: 'tna',
    })
    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      tasa: 0.0045,
      operacion: 'ambas',
    })
    expect(filas.find((f) => f.producto === 'cedears')).toMatchObject({
      tasa: 0.0045,
    })
    expect(filas.find((f) => f.producto === 'bonos')).toBeTruthy()
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.001,
    })
    expect(filas.find((f) => f.producto === 'cheques')).toMatchObject({
      tasa: 0.01,
      tasaBase: 'tna',
    })
  })
})

describe('parsearPpi', () => {
  it('usa columna Internet y emite productos flat', () => {
    const html = readFileSync(join(fixturesDir, 'ppi-comisiones.html'), 'utf8')
    const filas = parsearPpi(html)

    expect(
      filas.some(
        (f) => f.producto === 'cauciones' && f.operacion === 'tomadora',
      ),
    ).toBe(false)
    expect(filas.find((f) => f.producto === 'cauciones' && f.moneda === 'ARS')).toMatchObject({
      entidad: 'ppi',
      operacion: 'colocadora',
      tasa: 0.02,
      tasaBase: 'anual',
      ivaAdicional: true,
    })
    expect(filas.find((f) => f.producto === 'cauciones' && f.moneda === 'USD')).toMatchObject({
      operacion: 'colocadora',
      tasa: 0.01,
      tasaEsTope: true,
    })

    expect(filas.filter((f) => f.producto === 'acciones').length).toBeGreaterThanOrEqual(1)
    expect(filas.filter((f) => f.producto === 'cedears').length).toBeGreaterThanOrEqual(1)
    expect(filas.find((f) => f.producto === 'opciones' && f.operacion === 'ambas')).toMatchObject({
      tasa: 0.01,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toBeTruthy()
    expect(filas.find((f) => f.producto === 'cheques')).toBeTruthy()
  })
})

describe('parsearFiwind', () => {
  it('emite acciones/cedears/letras/cauciones con derecho BYMA', () => {
    const html = readFileSync(
      join(fixturesDir, 'fiwind-comisiones.html'),
      'utf8',
    )
    const filas = parsearFiwind(html)

    expect(filas.find((f) => f.producto === 'cauciones')).toMatchObject({
      entidad: 'fiwind',
      operacion: 'ambas',
      tasa: 0.02,
      tasaEsTope: true,
      tasaBase: 'anual',
      derechoMercado: 0.00045,
      ivaAdicional: true,
    })
    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      tasa: 0.0025,
      derechoMercado: 0.0005,
    })
    expect(filas.find((f) => f.producto === 'cedears')).toMatchObject({
      tasa: 0.0025,
      derechoMercado: 0.0005,
    })
    expect(filas.find((f) => f.producto === 'letras')).toMatchObject({
      tasa: 0.01,
      tasaBase: 'anual',
    })
  })
})

describe('parsearIebMas', () => {
  it('emite comisión 0 con membresiaMensual en cada producto Investor', () => {
    const html = readFileSync(
      join(fixturesDir, 'iebmas-planes.html'),
      'utf8',
    )
    const filas = parsearIebMas(html)

    expect(filas.some((f) => f.producto === 'abono')).toBe(false)

    const acciones = filas.find(
      (f) => f.producto === 'acciones' && f.plan === 'investor',
    )
    expect(acciones).toMatchObject({
      entidad: 'iebmas',
      nombreComercial: 'IEB+',
      tasa: 0,
      tasaAnualEquivalente: 0,
      operacion: 'ambas',
      membresiaMensual: 5000,
      membresiaIvaAdicional: true,
    })

    expect(filas.find((f) => f.producto === 'cauciones')).toMatchObject({
      tasa: 0,
      plan: 'investor',
      membresiaMensual: 5000,
      membresiaIvaAdicional: true,
    })
    expect(filas.find((f) => f.producto === 'fci' && f.plan === 'rookie')).toMatchObject({
      tasa: 0,
      membresiaMensual: null,
      membresiaIvaAdicional: false,
    })
  })
})

describe('parsearEcoValores', () => {
  it('toma No Asesorados sin club/intraday y máximos de cauciones/cheques/fci', () => {
    const html = readFileSync(join(fixturesDir, 'eco-tarifario.html'), 'utf8')
    const filas = parsearEcoValores(html)

    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      entidad: 'ecovalores',
      plan: 'no_asesorado',
      tasa: 0.0033,
      derechoMercado: 0.0005,
    })
    expect(filas.find((f) => f.producto === 'cedears')).toMatchObject({
      tasa: 0.0033,
    })
    expect(filas.find((f) => f.producto === 'bonos')).toMatchObject({
      tasa: 0.0049,
      derechoMercado: 0.0001,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.001,
    })
    expect(filas.find((f) => f.producto === 'opciones')).toMatchObject({
      tasa: 0.0021,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'colocadora'),
    ).toMatchObject({
      tasa: 0.0025,
      tasaEsTope: true,
      tasaBase: 'mensual',
      prorrateoDias: 30,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'tomadora'),
    ).toMatchObject({
      tasa: 0.005,
    })
    expect(filas.find((f) => f.producto === 'cheques')).toMatchObject({
      tasa: 0.07,
      tasaEsTope: true,
    })
    expect(filas.find((f) => f.producto === 'fci')).toMatchObject({
      tasa: 0,
    })
  })
})

describe('parsearMacroSecuritiesTexto', () => {
  it('extrae aranceles indicativos parseables', () => {
    const texto = readFileSync(join(fixturesDir, 'macro-aranceles.txt'), 'utf8')
    const filas = parsearMacroSecuritiesTexto(texto)

    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      entidad: 'macro',
      tasa: 0.01,
      ivaAdicional: true,
      comisionMinima: 5,
    })
    expect(filas.find((f) => f.producto === 'bonos')).toMatchObject({
      tasa: 0.01,
    })
    expect(filas.find((f) => f.producto === 'obligaciones_negociables')).toMatchObject({
      tasa: 0.005,
    })
    expect(filas.find((f) => f.producto === 'opciones')).toMatchObject({
      tasa: 0.015,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.01,
    })
    expect(filas.find((f) => f.producto === 'licitaciones')).toMatchObject({
      tasa: 0.01,
    })
    expect(filas.find((f) => f.producto === 'cheques')).toMatchObject({
      tasa: 0.04,
      tasaBase: 'tna',
    })
    expect(filas.some((f) => f.producto === 'cauciones')).toBe(false)
  })
})

describe('parsearPuenteTexto', () => {
  it('toma columna Internet del PDF de comisiones', () => {
    const texto = readFileSync(
      join(fixturesDir, 'puente-comisiones.txt'),
      'utf8',
    )
    const filas = parsearPuenteTexto(texto)

    expect(filas.find((f) => f.producto === 'acciones' && f.moneda === 'ARS')).toMatchObject({
      entidad: 'puente',
      tasa: 0.005,
      ivaAdicional: true,
      derechoMercado: 0.0006,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'colocadora' && f.moneda === 'ARS'),
    ).toMatchObject({
      tasa: 0.015,
      prorrateoDias: 90,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'tomadora' && f.moneda === 'ARS'),
    ).toMatchObject({
      tasa: 0.05,
    })
    expect(filas.find((f) => f.producto === 'opciones')).toMatchObject({
      tasa: 0.01,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.01,
    })
    expect(filas.find((f) => f.producto === 'cheques')).toMatchObject({
      tasa: 0.01,
    })
    expect(
      filas.some((f) => f.producto === 'alquiler_titulos' && f.operacion === 'colocadora'),
    ).toBe(true)
  })
})

describe('parsearGaliciaSecurities', () => {
  it('extrae comisiones máximas del tarifario publicado', () => {
    const html = readFileSync(
      join(fixturesDir, 'galicia-comisiones.html'),
      'utf8',
    )
    const filas = parsearGaliciaSecurities(html)

    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      entidad: 'galicia',
      tasa: 0.015,
      tasaEsTope: true,
      ivaAdicional: true,
    })
    expect(filas.find((f) => f.producto === 'cedears')).toMatchObject({
      tasa: 0.015,
    })
    expect(filas.find((f) => f.producto === 'bonos')).toMatchObject({
      tasa: 0.015,
      tasaEsTope: true,
    })
    expect(filas.find((f) => f.producto === 'cauciones')).toMatchObject({
      tasa: 0.004,
      tasaBase: 'mensual',
      prorrateoDias: 30,
    })
    expect(filas.find((f) => f.producto === 'opciones')).toMatchObject({
      tasa: 0.025,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.02,
    })
    expect(
      filas.find((f) => f.producto === 'cheques' && f.operacion === 'venta'),
    ).toMatchObject({
      tasa: 0.025,
      comisionMinima: 50,
    })
    expect(
      filas.find((f) => f.producto === 'cheques' && f.operacion === 'compra'),
    ).toMatchObject({
      tasa: 0.015,
      comisionMinima: 50,
    })
  })
})

describe('parsearRava', () => {
  it('extrae máximos de renta variable, fija y futuros', () => {
    const html = readFileSync(join(fixturesDir, 'rava-aranceles.html'), 'utf8')
    const filas = parsearRava(html)

    expect(filas.find((f) => f.producto === 'acciones')).toMatchObject({
      entidad: 'rava',
      nombreComercial: 'Rava Bursátil',
      tasa: 0.008,
      tasaEsTope: true,
      derechoMercado: 0.0008,
      ivaAdicional: true,
    })
    expect(filas.find((f) => f.producto === 'cedears')).toMatchObject({
      tasa: 0.008,
    })
    expect(filas.find((f) => f.producto === 'bonos')).toMatchObject({
      tasa: 0.008,
      derechoMercado: 0.0001,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'tomadora'),
    ).toMatchObject({
      tasa: 0.006,
      tasaBase: 'mensual',
      prorrateoDias: 30,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'colocadora'),
    ).toMatchObject({
      tasa: 0.0045,
    })
    expect(filas.find((f) => f.producto === 'opciones')).toMatchObject({
      tasa: 0.012,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      tasa: 0.005,
    })
    expect(filas.find((f) => f.producto === 'licitaciones')).toMatchObject({
      tasa: 0.0025,
    })
    expect(
      filas.some((f) => f.producto === 'alquiler_titulos'),
    ).toBe(true)
  })
})

describe('parsearAllariaTexto', () => {
  it('extrae autogestión y asistida del PDF de aranceles', () => {
    const texto = readFileSync(
      join(fixturesDir, 'allaria-aranceles.txt'),
      'utf8',
    )
    const filas = parsearAllariaTexto(texto)

    expect(
      filas.find((f) => f.producto === 'acciones' && f.plan === 'autogestion'),
    ).toMatchObject({
      entidad: 'allaria',
      nombreComercial: 'Allaria Inversiones',
      tasa: 0.005,
      tasaEsTope: true,
      ivaAdicional: true,
    })
    expect(
      filas.find((f) => f.producto === 'bonos' && f.plan === 'autogestion'),
    ).toMatchObject({
      tasa: 0.0025,
      ivaAdicional: false,
    })
    expect(
      filas.find((f) => f.producto === 'opciones' && f.plan === 'autogestion'),
    ).toMatchObject({
      tasa: 0.006,
      ivaAdicional: true,
    })
    expect(
      filas.find(
        (f) =>
          f.producto === 'acciones' &&
          f.plan === 'asistida' &&
          f.moneda === 'ARS' &&
          !f.metadata?.mercado,
      ),
    ).toMatchObject({
      tasa: 0.015,
      comisionMinima: 20,
      ivaAdicional: true,
    })
    expect(
      filas.find(
        (f) =>
          f.producto === 'acciones' &&
          f.plan === 'asistida' &&
          f.moneda === 'USD',
      ),
    ).toMatchObject({
      tasa: 0.015,
      comisionMinima: 10,
      metadata: expect.objectContaining({ mercado: 'exterior' }),
    })
    expect(
      filas.find(
        (f) =>
          f.producto === 'bonos' && f.plan === 'asistida' && f.moneda === 'ARS',
      ),
    ).toMatchObject({
      tasa: 0.015,
      comisionMinima: 20,
    })
    expect(
      filas.find(
        (f) =>
          f.producto === 'bonos' && f.plan === 'asistida' && f.moneda === 'USD',
      ),
    ).toMatchObject({
      tasa: 0.015,
      comisionMinima: 10,
    })
    expect(
      filas.find((f) => f.producto === 'obligaciones_negociables'),
    ).toMatchObject({
      plan: 'asistida',
      tasa: 0.015,
    })
    expect(
      filas.find((f) => f.producto === 'opciones' && f.plan === 'asistida'),
    ).toMatchObject({
      tasa: 0.025,
      comisionMinima: 20,
    })
    expect(filas.find((f) => f.producto === 'futuros')).toMatchObject({
      plan: 'asistida',
      tasa: 0.015,
      comisionMinima: 20,
    })
    expect(
      filas.find((f) => f.producto === 'cauciones' && f.operacion === 'tomadora'),
    ).toMatchObject({
      tasa: 0.004,
      prorrateoDias: 30,
    })
    expect(
      filas.find(
        (f) => f.producto === 'cauciones' && f.operacion === 'colocadora',
      ),
    ).toMatchObject({
      tasa: 0.002,
      prorrateoDias: 30,
    })
  })
})

describe('crearComisionBroker', () => {
  it('completa shape comparable', () => {
    const fila = crearComisionBroker({
      entidad: 'iol',
      nombreComercial: 'InvertirOnline',
      operacion: 'colocadora',
      tasa: 0.0015,
      tasaBase: 'mensual',
    })
    expect(fila.producto).toBe('cauciones')
    expect(fila.tasaAnualEquivalente).toBe(0.018)
    expect(fila.membresiaMensual).toBeNull()
    expect(fila.membresiaIvaAdicional).toBe(false)
    expect(fila.metadata).toEqual({})
  })
})

describe('extraerComisionesBrokers aggregator', () => {
  it('arma payload con Promise.allSettled y sin Firecrawl', async () => {
    vi.resetModules()
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerIol.js',
      () => ({
        extraerIol: vi.fn(async () => [
          crearComisionBroker({
            entidad: 'iol',
            nombreComercial: 'InvertirOnline',
            operacion: 'colocadora',
            tasa: 0.0015,
            tasaBase: 'mensual',
          }),
        ]),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerBalanz.js',
      () => ({
        extraerBalanz: vi.fn(async () => {
          throw new Error('balanz down')
        }),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerBullMarket.js',
      () => ({
        extraerBullMarket: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerCocos.js',
      () => ({
        extraerCocos: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerPpi.js',
      () => ({
        extraerPpi: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerFiwind.js',
      () => ({
        extraerFiwind: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerIebMas.js',
      () => ({
        extraerIebMas: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerEcoValores.js',
      () => ({
        extraerEcoValores: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerMacroSecurities.js',
      () => ({
        extraerMacroSecurities: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerPuente.js',
      () => ({
        extraerPuente: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerGaliciaSecurities.js',
      () => ({
        extraerGaliciaSecurities: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerRava.js',
      () => ({
        extraerRava: vi.fn(async () => []),
      }),
    )
    vi.doMock(
      '@/finanzas/brokers/comisiones/extraccion/extraerAllaria.js',
      () => ({
        extraerAllaria: vi.fn(async () => []),
      }),
    )

    const { extraerComisionesBrokers } = await import(
      '@/finanzas/brokers/comisiones/extraccion/extraerComisionesBrokers.js'
    )

    const payload = await extraerComisionesBrokers()
    expect(payload.comisiones).toHaveLength(1)
    expect(payload.comisiones[0].entidad).toBe('iol')
    expect(payload.fechaActualizacion).toMatch(/^\d{4}-/)
    expect(payload.erroresExtraccion).toEqual([
      { fuente: 'balanz', error: 'balanz down' },
    ])
  })
})
