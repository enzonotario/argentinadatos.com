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
import { parseArancelTexto } from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

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

describe('parsearGetnet', () => {
  it('extrae filas por medio y acreditación', () => {
    const html = readFileSync(join(fixturesDir, 'getnet-aranceles.html'), 'utf8')
    const filas = parsearGetnet(html)

    expect(filas.length).toBeGreaterThanOrEqual(8)

    const qrInmediata = filas.find(
      f =>
        f.medioPago === 'qr_cuenta' && f.acreditacionTipo === 'inmediata',
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
    expect(filas.find(f => f.canal === 'pos' && f.medioPago === 'debito')).toMatchObject({
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
      c =>
        c.medioPago === 'debito' && c.acreditacionTipo === 'inmediata',
    )
    expect(debitoInstante).toMatchObject({
      entidad: 'mercadopago',
      arancel: 0.0314,
      ivaAdicional: true,
      canal: 'pos',
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
