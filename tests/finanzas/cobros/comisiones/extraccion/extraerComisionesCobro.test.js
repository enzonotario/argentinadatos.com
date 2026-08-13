import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parsearGetnet } from '@/finanzas/cobros/comisiones/extraccion/extraerGetnet.js'
import {
  parsearUalaBis,
  parsearUalaBisQr,
  parsearUalaBisLectores,
} from '@/finanzas/cobros/comisiones/extraccion/extraerUala.js'
import {
  parsearMercadoPagoMarkdown,
  extraerTablaGrupoDefault,
} from '@/finanzas/cobros/comisiones/extraccion/extraerMercadoPago.js'
import { parsearPayway } from '@/finanzas/cobros/comisiones/extraccion/extraerPayway.js'
import { parsearProvincia } from '@/finanzas/cobros/comisiones/extraccion/extraerProvincia.js'
import {
  parseArancelTexto,
  inferirAcreditacionTipo,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('parseArancelTexto', () => {
  it('parsea hasta X% + IVA', () => {
    expect(parseArancelTexto('Hasta 1,53% + IVA')).toMatchObject({
      arancel: 0.0153,
      arancelEsTope: true,
      ivaAdicional: true,
    })
  })

  it('parsea porcentaje fijo', () => {
    expect(parseArancelTexto('0,80% + IVA')).toMatchObject({
      arancel: 0.008,
      arancelEsTope: false,
      ivaAdicional: true,
    })
  })

  it('devuelve null para celda vacía', () => {
    expect(parseArancelTexto('-').arancel).toBeNull()
  })
})

describe('inferirAcreditacionTipo', () => {
  it('clasifica labels de Mercado Pago con N días', () => {
    expect(inferirAcreditacionTipo('Al instante')).toBe('inmediata')
    expect(inferirAcreditacionTipo('2 días')).toBe('estandar')
    expect(inferirAcreditacionTipo('10 días')).toBe('estandar')
    expect(inferirAcreditacionTipo('1 día')).toBe('anticipada')
  })
})

describe('parsearGetnet', () => {
  it('extrae filas por medio y acreditación', () => {
    const html = readFileSync(
      join(fixturesDir, 'getnet-aranceles.html'),
      'utf8',
    )
    const filas = parsearGetnet(html)

    expect(filas.length).toBeGreaterThanOrEqual(8)

    const qrInmediata = filas.find(
      f => f.medioPago === 'qr_cuenta' && f.acreditacionTipo === 'inmediata',
    )
    expect(qrInmediata).toMatchObject({
      entidad: 'getnet',
      arancel: 0.008,
      arancelEsTope: false,
      ivaAdicional: true,
      canal: 'qr',
    })

    const debitoInmediata = filas.find(
      f => f.medioPago === 'debito' && f.acreditacionTipo === 'inmediata',
    )
    expect(debitoInmediata).toMatchObject({
      arancel: 0.0153,
      arancelEsTope: true,
    })

    const creditoEstandar = filas.find(
      f => f.medioPago === 'credito' && f.acreditacionTipo === 'estandar',
    )
    expect(creditoEstandar).toMatchObject({
      arancel: 0.02,
      arancelEsTope: true,
      acreditacionPlazoHabiles: 8,
    })
  })
})

describe('parsearUalaBis', () => {
  it('extrae QR y POS', () => {
    const qrHtml = readFileSync(join(fixturesDir, 'ualabis-qr.html'), 'utf8')
    const lectoresHtml = readFileSync(
      join(fixturesDir, 'ualabis-lectores.html'),
      'utf8',
    )

    expect(parsearUalaBisQr(qrHtml)).toHaveLength(3)
    expect(parsearUalaBisLectores(lectoresHtml)).toHaveLength(2)

    const filas = parsearUalaBis({ qrHtml, lectoresHtml })
    expect(filas).toHaveLength(5)

    expect(filas.find(f => f.medioPago === 'qr_cuenta')).toMatchObject({
      entidad: 'uala',
      arancel: 0.008,
      canal: 'qr',
    })
    expect(
      filas.find(f => f.canal === 'pos' && f.medioPago === 'debito'),
    ).toMatchObject({
      arancel: 0.029,
    })
  })
})

describe('parsearMercadoPagoMarkdown', () => {
  it('parsea Point del grupo Buenos Aires', () => {
    const markdown = readFileSync(
      join(fixturesDir, 'mercadopago-point.md'),
      'utf8',
    )

    const { grupoProvincial, filas } = extraerTablaGrupoDefault(markdown)
    expect(grupoProvincial).toMatch(/Buenos Aires/)
    expect(filas.length).toBeGreaterThanOrEqual(6)

    const comisiones = parsearMercadoPagoMarkdown(markdown, {
      canal: 'pos',
      productoPrefijo: 'Point',
      url: 'https://www.mercadopago.com.ar/ayuda/2779',
    })

    const debitoInstante = comisiones.find(
      c => c.medioPago === 'debito' && c.acreditacionTipo === 'inmediata',
    )
    expect(debitoInstante).toMatchObject({
      entidad: 'mercadopago',
      arancel: 0.0314,
      ivaAdicional: true,
      canal: 'pos',
    })

    const debitoDosDias = comisiones.find(
      c => c.medioPago === 'debito' && c.acreditacionPlazoHabiles === 2,
    )
    expect(debitoDosDias).toMatchObject({
      acreditacionTipo: 'estandar',
      acreditacionLabel: '2 días',
    })
  })

  it('parsea QR dinero en cuenta', () => {
    const markdown = readFileSync(
      join(fixturesDir, 'mercadopago-qr.md'),
      'utf8',
    )
    const comisiones = parsearMercadoPagoMarkdown(markdown, {
      canal: 'qr',
      productoPrefijo: 'QR',
      url: 'https://www.mercadopago.com.ar/ayuda/3605',
    })

    const cuenta = comisiones.find(c => c.medioPago === 'qr_cuenta')
    expect(cuenta).toMatchObject({
      arancel: 0.008,
      acreditacionTipo: 'inmediata',
    })
  })
})

describe('parsearPayway', () => {
  it('extrae QR inmediato, débito 1 día y crédito 1/8 días', () => {
    const html = readFileSync(join(fixturesDir, 'payway-planes.html'), 'utf8')
    const filas = parsearPayway(html)

    expect(filas).toHaveLength(4)

    expect(filas.find(f => f.medioPago === 'qr_cuenta')).toMatchObject({
      entidad: 'payway',
      canal: 'qr',
      arancel: 0.008,
      arancelEsTope: true,
      ivaAdicional: true,
      acreditacionTipo: 'inmediata',
      acreditacionPlazoHabiles: 0,
    })

    expect(filas.find(f => f.medioPago === 'debito')).toMatchObject({
      canal: 'pos',
      arancel: 0.012,
      arancelEsTope: true,
      acreditacionTipo: 'anticipada',
      acreditacionPlazoHabiles: 1,
    })

    const creditos = filas.filter(f => f.medioPago === 'credito')
    expect(creditos).toHaveLength(2)
    expect(creditos.find(f => f.acreditacionPlazoHabiles === 1)).toMatchObject({
      arancel: 0.063,
      acreditacionTipo: 'anticipada',
    })
    expect(creditos.find(f => f.acreditacionPlazoHabiles === 8)).toMatchObject({
      arancel: 0.02,
      acreditacionTipo: 'estandar',
    })
  })
})

describe('parsearProvincia', () => {
  it('extrae Clave DNI, QR y POS Fiserv/Payway', () => {
    const html = readFileSync(
      join(fixturesDir, 'provincia-adhesion.html'),
      'utf8',
    )
    const filas = parsearProvincia(html)

    expect(filas).toHaveLength(11)

    expect(filas.find(f => f.producto === 'Clave DNI')).toMatchObject({
      entidad: 'provincia',
      canal: 'qr',
      medioPago: 'qr_cuenta',
      arancel: 0.006,
      ivaAdicional: false,
      acreditacionTipo: 'inmediata',
      acreditacionPlazoHabiles: 0,
    })

    expect(filas.find(f => f.producto === 'QR dinero en cuenta')).toMatchObject(
      {
        canal: 'qr',
        medioPago: 'qr_cuenta',
        arancel: 0.008,
        ivaAdicional: true,
        acreditacionTipo: 'inmediata',
      },
    )

    expect(filas.find(f => f.producto === 'Débito Fiserv')).toMatchObject({
      canal: 'pos',
      medioPago: 'debito',
      arancel: 0.008,
      ivaAdicional: true,
      acreditacionTipo: 'anticipada',
      acreditacionPlazoHabiles: 1,
    })

    expect(filas.find(f => f.producto === 'Débito Payway Visa')).toMatchObject({
      arancel: 0.012,
      acreditacionTipo: 'anticipada',
    })

    expect(
      filas.find(f => f.producto === 'Débito Payway Mastercard'),
    ).toMatchObject({
      arancel: 0.014,
    })

    expect(
      filas.find(f => f.producto === 'Crédito 1 pago Fiserv'),
    ).toMatchObject({
      medioPago: 'credito',
      arancel: 0.018,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 8,
    })

    expect(
      filas.find(f => f.producto === 'Crédito 1 pago Payway Amex'),
    ).toMatchObject({
      medioPago: 'amex',
      arancel: 0.028,
      ivaAdicional: true,
    })

    expect(
      filas.find(f => f.producto === 'Crédito en cuotas Fiserv'),
    ).toMatchObject({
      medioPago: 'credito_cuotas',
      arancel: 0.018,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 2,
    })
  })
})
