import { describe, expect, it } from 'vitest'
import { logGrupo } from '@/log.js'
import { mapearAstropayRemesas } from '@/finanzas/remesas/extraccion/extraerAstropayRemesas.js'
import {
  detectarCuentaPropiaGlobal66,
  mapearGlobal66Remesas,
} from '@/finanzas/remesas/extraccion/extraerGlobal66Remesas.js'
import { mapearLemonRemesas } from '@/finanzas/remesas/extraccion/extraerLemonRemesas.js'
import { mapearArqRemesas } from '@/finanzas/remesas/extraccion/extraerArqRemesas.js'
import { mapearGrabrfiRemesas } from '@/finanzas/remesas/extraccion/extraerGrabrfiRemesas.js'
import { mapearPayoneerRemesas } from '@/finanzas/remesas/extraccion/extraerPayoneerRemesas.js'
import { mapearTakenosRemesas } from '@/finanzas/remesas/extraccion/extraerTakenosRemesas.js'
import { mapearWallbitRemesas } from '@/finanzas/remesas/extraccion/extraerWallbitRemesas.js'
import { mapearWiseRemesas } from '@/finanzas/remesas/extraccion/extraerWiseRemesas.js'
import {
  extraerFuentesDirectasRemesas,
  htmlATexto,
} from '@/finanzas/remesas/extraccion/extraerRemesasDirectas.js'
import { reemplazarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

const WALLBIT = `
Wallbit no cobra comisiones por depósitos en USD, EUR, USDC, USDT ni moneda local.
Cuenta a tu nombre en Estados Unidos.
Depósitos 100% gratuitos. Acceso a más de 12.000 activos de inversión.
Tarjeta Visa Platinum. Cuenta remunerada con 2.75% APR.
Depósitos (ACH, Wire, Moneda local, Cripto) Gratis Gratis Gratis
Uso de tarjeta en USD Gratis. Uso de tarjeta en otra moneda Sin comisión (USD) o 2% FX
Todos los países FX estándar. fee fijo adicional de 0.35 USD
`

const TAKENOS = `
Recibir transferencias ACH en USD son totalmente gratis.
Wire Transfer en USD tiene un costo de 25 USD.
Gastos con la TakeCard: se aplica una comisión del 1% por cada transacción.
Saldo en USD Digital. Retiros en pesos argentinos (ARS) son totalmente gratuitos.
Inversiones
`

const GRABRFI = `
Same-day incoming ACH $0. Standard incoming ACH $0.
Monthly maintenance $0.
US domestic incoming wire $15.
Foreign transaction fee (purchases in the United States) Free.
Foreign transaction fee (purchases outside the United States) 1.5%.
Withdrawals to local currency. Argentina $5.
held as digital dollars (USDB or USDC).
Prepaid Debit Visa Card is issued by Lead Bank.
Boost earnings are not interest, yield or investment returns.
`

const WISE = `
Receiving domestic payments (non-Swift / non-wire) Receive AUD, CAD, EUR, GBP, USD Free.
Receiving USD wire and Swift payments Fixed fee per payment 6.11 USD.
`

const PAYONEER = `
Via a receiving account in a currency that is not your local currency 1% (minimum fee of 1.00 USD or equivalent).
From a payer using ACH bank debit (US only) 1%.
Annual card fee 29.95 USD.
Card purchases without currency conversion Up to 1.8%.
Card transactions with currency conversion Up to 3.5%.
To a bank account in the recipient's local currency 1.2% – 4%.
`

const ARQ = `
This article refers to costs for customers with residence address in Argentina.
3 USDc fee when depositing funds from US dollar accounts.
Virtual ARQ: Get your virtual card without any charge.
Deposits and transfers in local currencies without fees.
International purchases in Argentine pesos: 5% commission.
ATM withdrawals: 1% commission.
Global card: $2.99 USDc. Local card: $2,000.00 ARS.
It is a card issued outside Argentina.
Local card: Card issued in Argentina.
Beneficiary name: Your name. Bank name: Lead Bank. Type of account: Checking account.
you get your own US account details. Transaction cost: $3 USD per transaction.
Maintain your digital dollars and earn rewards at no additional cost.
`

describe('mapear remesas desde fuente oficial', () => {
  it('lee Wallbit desde la página de precios', () => {
    expect(mapearWallbitRemesas(WALLBIT)).toMatchObject({
      compania: 'wallbit',
      cuentaPropia: true,
      moneda: 'FIAT',
      inversiones: true,
      tarjetaUsa: true,
      costoRecibirPagos: '0',
      costoTarjeta: '0%',
      retiroArs: 'FX',
    })
  })

  it('lee Takenos desde el blog de comisiones', () => {
    const remesa = mapearTakenosRemesas(TAKENOS)

    expect(remesa).toMatchObject({
      compania: 'takenos',
      moneda: 'CRIPTO',
      costoRecibirPagos: '0',
      costoTarjeta: '1%',
      retiroArs: '0',
    })
    expect(remesa.detalles.costoRecibirPagos).toContain('25 USD')
  })

  it('lee GrabrFi desde el schedule de fees', () => {
    expect(mapearGrabrfiRemesas(GRABRFI)).toMatchObject({
      compania: 'grabrfi',
      moneda: 'CRIPTO',
      tarjetaUsa: true,
      costoRecibirPagos: '0',
      costoTarjeta: '0%',
      retiroArs: '5 USD',
      inversiones: false,
    })
  })

  it('lee Wise: ACH gratis y wire 6,11 USD', () => {
    const remesa = mapearWiseRemesas(WISE)

    expect(remesa).toMatchObject({
      compania: 'wise',
      cuentaPropia: false,
      tarjetaUsa: false,
      costoRecibirPagos: '0',
      retiroArs: null,
    })
    expect(remesa.detalles.costoRecibirPagos).toContain('6,11 USD')
  })

  it('lee Payoneer desde la página de pricing', () => {
    expect(mapearPayoneerRemesas(PAYONEER)).toMatchObject({
      compania: 'payoneer',
      costoRecibirPagos: '1%',
      costoMantenimientoTarjeta: '29.95 USD',
      costoTarjeta: '1.8% a 3.5%',
      retiroArs: '1.2% a 4%',
      tarjetaUsa: false,
    })
  })

  it('lee AstroPay desde tarjetas, anexo argentino y cuenta USD', () => {
    const remesa = mapearAstropayRemesas(`
      Tu tarjeta virtual lista en minutos y sin costo.
      AstroCard Global. Emitida en el exterior.
      Costo de emisión de la primera tarjeta AstroPay virtual 0 ARS.
      Costo de mantenimiento, renovación y cierre de cuenta 0 ARS.
      Costo por consumos con la tarjeta 0 ARS.
      El dinero no devengan intereses.
      Esta cuenta no es una cuenta personal a nombre del usuario.
      Recibir fondos a través de ACH, SWIFT o Wire.
      Usted no recibirá intereses.
    `)

    expect(remesa).toMatchObject({
      compania: 'AstroPay',
      cuentaPropia: false,
      moneda: 'FIAT',
      inversiones: false,
      tarjetaUsa: true,
      costoRecibirPagos: null,
      costoMantenimientoTarjeta: '0 ARS',
      costoTarjeta: '0 ARS',
      retiroArs: null,
    })
    expect(remesa.detalles.cuentaPropia).toContain('FBO')
    expect(remesa.detalles.costoRecibirPagos).toContain('no publican')
  })

  it('lee Global66 y marca cuentaPropia desde /ar/freelancers/', () => {
    const texto = `
      Sin conversiones automáticas ni recargos por moneda extranjera.
      Es una tarjeta digital y global.
      Las transferencias ACH son gratuitas.
      Wire y SWIFT tienen un costo fijo de recepción de $10 USD.
      Tu Smart Card no tiene comisiones de mantenimiento si realizás al menos una compra al mes.
      Sin cargos ocultos por compras internacionales.
      En Argentina, la tarjeta está disponible exclusivamente en formato virtual.
      Tu cuenta en dólares funciona como una cuenta bancaria en USD (tipo Checking).
      Sin costos de mantención.
      Recepción gratuita.
      Rendimiento de hasta 6% anual.
      Te damos un número de cuenta en Estados Unidos y Europa a tu nombre.
      Al abrir tu cuenta, te damos datos bancarios locales a tu nombre (Routing Number y Account Number para USA, e IBAN para Europa).
    `

    expect(detectarCuentaPropiaGlobal66(texto)).toBe(true)

    const remesa = mapearGlobal66Remesas(texto)

    expect(remesa).toMatchObject({
      compania: 'Global66',
      cuentaPropia: true,
      moneda: 'FIAT',
      inversiones: true,
      tarjetaUsa: true,
      costoRecibirPagos: '0',
      costoMantenimientoTarjeta: '0 si hay 1 compra al mes',
      costoTarjeta: '0',
      retiroArs: null,
    })
    expect(remesa.detalles.cuentaPropia).toContain('freelancers')
    expect(remesa.detalles.cuentaPropia).toContain('a tu nombre')
    expect(remesa.detalles.costoRecibirPagos).toContain('10 USD')
  })

  it('no marca cuentaPropia Global66 sin claim a tu nombre', () => {
    expect(
      detectarCuentaPropiaGlobal66(
        'Cuenta tipo Checking con Routing Number y Account Number.',
      ),
    ).toBe(false)
  })

  it('lee Lemon desde la tarjeta y el centro de ayuda', () => {
    const remesa = mapearLemonRemesas(`
      Pedí tu VISA Lemon Card desde la app sin costo de envío ni mantenimiento.
      ACH domésticas e internacionales tienen una comisión de 1.5%.
      Wires domésticas tienen una comisión de 1.5% + 12 USD fijos.
      No serás el titular de una cuenta bancaria.
      Bridge requiere que abones 4 USD para abrir la cuenta virtual.
      Todo tu saldo en Dólar Digital genera rendimientos, sin tope.
      Retiros en pesos 0,00 ARS.
      Desde USDt los consumos se procesan 1 a 1 vs USD.
      Desde otra crypto se aplica una comisión de 0.3%.
      Desde ARS se aplica una comisión de 0.5%.
    `)

    expect(remesa).toMatchObject({
      compania: 'Lemon',
      cuentaPropia: false,
      moneda: 'CRIPTO',
      inversiones: true,
      tarjetaUsa: false,
      costoRecibirPagos: '1.5%',
      costoMantenimientoTarjeta: '0',
      costoTarjeta: '0',
      retiroArs: '0',
    })
    expect(remesa.detalles.cuentaPropia).toContain('Lead Bank')
    expect(remesa.detalles.costoRecibirPagos).toContain('12 USD')
  })

  it('lee ARQ desde las páginas de Argentina', () => {
    expect(mapearArqRemesas(ARQ)).toMatchObject({
      compania: 'arq',
      cuentaPropia: true,
      moneda: 'CRIPTO',
      inversiones: true,
      tarjetaUsa: true,
      costoRecibirPagos: '3 USD',
      costoMantenimientoTarjeta: '0 USD',
      costoTarjeta: '0%',
      retiroArs: '0',
    })
  })

  it('limpia HTML antes de buscar frases', () => {
    const texto = htmlATexto(
      '<script>ignore 6.11 USD</script><p>Receiving domestic payments USD Free</p>',
    )

    expect(texto).not.toContain('ignore')
    expect(texto).toContain('Receiving domestic payments')
  })

  it('reemplaza la fila de Dolarito si la fuente oficial responde', () => {
    const remesas = [
      { compania: 'wise', costoRecibirPagos: '6,11 USD' },
      { compania: 'airtm', costoRecibirPagos: '0' },
    ]

    reemplazarRemesa(remesas, mapearWiseRemesas(WISE))

    expect(remesas).toHaveLength(2)
    expect(remesas[0].costoRecibirPagos).toBe('0')
    expect(remesas[1].compania).toBe('airtm')
  })
})

describe('fuentes oficiales vivas', () => {
  it('parsea las páginas oficiales de una sola URL', async () => {
    const log = logGrupo({ fuente: 'test', tipo: 'extraccion' })
    const resultados = await extraerFuentesDirectasRemesas(log)
    const fallos = resultados.filter(resultado => !resultado.ok)

    expect(fallos.map(fallo => fallo.error?.message)).toEqual([])

    const porNombre = Object.fromEntries(
      resultados.map(resultado => [
        resultado.remesa.compania,
        resultado.remesa,
      ]),
    )

    expect(porNombre.wallbit.costoRecibirPagos).toBe('0')
    expect(porNombre.takenos.costoTarjeta).toBe('1%')
    expect(porNombre.takenos.detalles.costoRecibirPagos).toContain('25 USD')
    expect(porNombre.grabrfi.retiroArs).toBe('5 USD')
    expect(porNombre.wise.costoRecibirPagos).toBe('0')
    expect(porNombre.wise.detalles.costoRecibirPagos).toContain('6,11 USD')
    expect(porNombre.payoneer.costoRecibirPagos).toBe('1%')
  }, 60000)
})
