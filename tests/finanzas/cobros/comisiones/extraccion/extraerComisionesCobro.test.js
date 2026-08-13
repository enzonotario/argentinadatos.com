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
import { parsearFiserv } from '@/finanzas/cobros/comisiones/extraccion/extraerFiserv.js'
import { parsearNave } from '@/finanzas/cobros/comisiones/extraccion/extraerNave.js'
import { parsearOpenpay } from '@/finanzas/cobros/comisiones/extraccion/extraerOpenpay.js'
import { parsearViumi } from '@/finanzas/cobros/comisiones/extraccion/extraerViumi.js'
import { parsearMaspagos } from '@/finanzas/cobros/comisiones/extraccion/extraerMaspagos.js'
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

describe('parsearFiserv', () => {
  it('extrae PCT, débito y crédito 1 pago de las cards QR', () => {
    const html = readFileSync(join(fixturesDir, 'fiserv-pagos-qr.html'), 'utf8')
    const filas = parsearFiserv(html)

    expect(filas).toHaveLength(3)

    expect(filas.find(f => f.medioPago === 'qr_cuenta')).toMatchObject({
      entidad: 'fiserv',
      canal: 'qr',
      arancel: 0.008,
      ivaAdicional: true,
      acreditacionTipo: 'inmediata',
      acreditacionPlazoHabiles: 0,
    })

    expect(filas.find(f => f.medioPago === 'debito')).toMatchObject({
      canal: 'qr',
      arancel: 0.008,
      acreditacionTipo: 'anticipada',
      acreditacionPlazoHabiles: 1,
    })

    expect(filas.find(f => f.medioPago === 'credito')).toMatchObject({
      canal: 'qr',
      arancel: 0.018,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 8,
    })
    expect(filas.find(f => f.medioPago === 'credito').condiciones).toMatch(
      /Planes Ahora/,
    )
  })

  it('parsea el HTML de pagosconqr con el 1,8% partido por tags', () => {
    const html = `
      <h4>Pagos con Transferencia (PCT)</h4>
      <h5>Dinero Disponible en el momento en la Cuenta Bancaria. Tasa de Descuento 0,8% + IVA</h5>
      <h4>Débito</h4>
      <h5>Dinero Disponible en 24 horas hábiles en la Cuenta Bancaria. Arancel 0,8% + IVA</h5>
      <h4>Crédito</h4>
      <h5>Dinero Disponible en 8 días hábiles en la Cuenta Bancaria (*). 1 Cuota 1<b>,8%</b> + IVA</h5>
      <p>(*) Planes Ahora 10 DH, Grandes Contribuyentes 18 DH, Cuotas con Financiación otorgante 2 DH, Plan Cuota a Cuota 1° Cuota 18 DH, Tarjeta local no financiera 18 DH</p>
    `
    const filas = parsearFiserv(html)
    expect(filas).toHaveLength(3)
    expect(filas.find(f => f.medioPago === 'credito').arancel).toBe(0.018)
  })

  it('ignora la página de captcha Radware', () => {
    expect(parsearFiserv('<title>Radware Bot Manager Captcha</title>')).toEqual(
      [],
    )
  })
})

describe('parsearNave', () => {
  it('extrae inmediata y otros plazos por medio', () => {
    const html = readFileSync(join(fixturesDir, 'nave-costos.html'), 'utf8')
    const filas = parsearNave(html)

    expect(filas).toHaveLength(11)

    expect(
      filas.find(
        f => f.medioPago === 'qr_cuenta' && f.acreditacionTipo === 'inmediata',
      ),
    ).toMatchObject({
      entidad: 'nave',
      canal: 'qr',
      arancel: 0.008,
      ivaAdicional: true,
      acreditacionPlazoHabiles: 0,
    })

    expect(
      filas.find(
        f => f.medioPago === 'debito' && f.acreditacionTipo === 'inmediata',
      ),
    ).toMatchObject({
      arancel: 0.016,
      producto: 'Débito',
    })

    expect(
      filas.find(
        f => f.medioPago === 'debito' && f.acreditacionPlazoHabiles === 1,
      ),
    ).toMatchObject({
      arancel: 0.008,
      arancelEsTope: true,
      acreditacionTipo: 'anticipada',
    })

    expect(
      filas.find(
        f =>
          f.producto === 'Crédito / prepaga' &&
          f.acreditacionTipo === 'inmediata',
      ),
    ).toMatchObject({
      arancel: 0.058,
    })

    expect(filas.find(f => f.producto === 'Crédito 1 pago')).toMatchObject({
      arancel: 0.018,
      arancelEsTope: true,
      acreditacionPlazoHabiles: 18,
    })

    expect(
      filas.find(f => f.producto === 'Crédito 3 y 6 cuotas'),
    ).toMatchObject({
      medioPago: 'credito_cuotas',
      acreditacionPlazoHabiles: 7,
    })

    expect(
      filas.find(f => f.producto === 'Débito internacional'),
    ).toMatchObject({
      arancel: 0.045,
      acreditacionTipo: 'inmediata',
    })
  })
})

describe('parsearOpenpay', () => {
  it('extrae QR, débito y crédito por plazo', () => {
    const html = readFileSync(
      join(fixturesDir, 'openpay-comisiones.html'),
      'utf8',
    )
    const filas = parsearOpenpay(html)

    expect(filas).toHaveLength(6)

    expect(filas.find(f => f.medioPago === 'qr_cuenta')).toMatchObject({
      entidad: 'openpay',
      canal: 'qr',
      arancel: 0.008,
      ivaAdicional: true,
      acreditacionTipo: 'inmediata',
      acreditacionPlazoHabiles: 0,
    })

    const debitos = filas.filter(f => f.medioPago === 'debito')
    expect(debitos).toHaveLength(2)
    expect(debitos.find(f => f.acreditacionTipo === 'inmediata')).toMatchObject(
      {
        arancel: 0.0319,
      },
    )
    expect(debitos.find(f => f.acreditacionPlazoHabiles === 2)).toMatchObject({
      arancel: 0.0299,
      acreditacionTipo: 'estandar',
    })

    const creditos = filas.filter(f => f.medioPago === 'credito')
    expect(creditos).toHaveLength(3)
    expect(
      creditos.find(f => f.acreditacionTipo === 'inmediata'),
    ).toMatchObject({
      arancel: 0.0619,
    })
    expect(creditos.find(f => f.acreditacionPlazoHabiles === 2)).toMatchObject({
      arancel: 0.0549,
    })
    expect(creditos.find(f => f.acreditacionPlazoHabiles === 10)).toMatchObject(
      {
        arancel: 0.0299,
      },
    )
  })
})

describe('parsearViumi', () => {
  it('extrae débito, crédito y prepagas y omite Alimentar oculta', () => {
    const html = readFileSync(
      join(fixturesDir, 'viumi-comisiones.html'),
      'utf8',
    )
    const filas = parsearViumi(html)

    expect(filas).toHaveLength(9)
    expect(filas.some(f => /alimentar/i.test(f.producto))).toBe(false)

    expect(filas.find(f => f.medioPago === 'debito')).toMatchObject({
      entidad: 'viumi',
      arancel: 0.0225,
      ivaAdicional: true,
      acreditacionTipo: 'anticipada',
      acreditacionPlazoHabiles: 1,
    })

    const creditos = filas.filter(f => f.medioPago === 'credito')
    expect(creditos).toHaveLength(6)
    expect(creditos.find(f => f.acreditacionPlazoHabiles === 1)).toMatchObject({
      arancel: 0.0539,
    })
    expect(creditos.find(f => f.acreditacionPlazoHabiles === 40)).toMatchObject(
      {
        arancel: 0,
      },
    )

    const prepagas = filas.filter(f => f.medioPago === 'prepaga')
    expect(prepagas).toHaveLength(2)
    expect(prepagas.find(f => f.arancel === 0.0539)).toMatchObject({
      acreditacionPlazoHabiles: 1,
    })
    expect(prepagas.find(f => f.arancel === 0.0499)).toMatchObject({
      acreditacionPlazoHabiles: 2,
    })
  })
})

describe('parsearMaspagos', () => {
  it('extrae transferencia, crédito y débito y deduplica link', () => {
    const html = readFileSync(
      join(fixturesDir, 'maspagos-comisiones.html'),
      'utf8',
    )
    const filas = parsearMaspagos(html)

    expect(filas).toHaveLength(9)
    expect(filas.every(f => f.entidad === 'maspagos')).toBe(true)
    expect(filas.every(f => f.ivaAdicional)).toBe(true)

    expect(
      filas.find(f => f.producto === 'QR transferencia (promo)'),
    ).toMatchObject({
      canal: 'qr',
      medioPago: 'qr_cuenta',
      arancel: 0,
      acreditacionTipo: 'inmediata',
    })
    expect(filas.find(f => f.producto === 'QR transferencia')).toMatchObject({
      arancel: 0.008,
      acreditacionTipo: 'inmediata',
    })

    expect(filas.find(f => f.producto === 'Crédito Fast Pay')).toMatchObject({
      canal: 'pos',
      medioPago: 'credito',
      arancel: 0.0398,
      acreditacionTipo: 'estandar',
      acreditacionPlazoHabiles: 2,
    })
    expect(
      filas.find(
        f => f.medioPago === 'credito' && f.acreditacionPlazoHabiles === 10,
      ),
    ).toMatchObject({
      arancel: 0.03,
      canal: 'pos',
    })
    expect(
      filas.find(
        f =>
          f.canal === 'pos' &&
          f.medioPago === 'credito' &&
          f.acreditacionPlazoHabiles === 18,
      ),
    ).toMatchObject({
      arancel: 0.023,
    })
    expect(
      filas.find(f => f.canal === 'link' && f.medioPago === 'credito'),
    ).toMatchObject({
      arancel: 0.03,
      acreditacionPlazoHabiles: 18,
    })

    expect(filas.find(f => f.producto === 'Débito QR')).toMatchObject({
      canal: 'qr',
      arancel: 0.0085,
      acreditacionTipo: 'anticipada',
      acreditacionPlazoHabiles: 1,
    })
    expect(
      filas.find(f => f.producto === 'Débito Smart POS / Tap to Phone'),
    ).toMatchObject({
      canal: 'pos',
      arancel: 0.021,
    })
    expect(
      filas.filter(f => f.producto === 'Débito link de pago'),
    ).toHaveLength(1)
    expect(filas.find(f => f.producto === 'Débito link de pago')).toMatchObject(
      {
        canal: 'link',
        arancel: 0.0675,
        acreditacionTipo: 'anticipada',
        acreditacionPlazoHabiles: 1,
      },
    )
  })
})
