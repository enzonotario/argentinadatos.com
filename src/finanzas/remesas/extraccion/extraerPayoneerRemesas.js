import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearPayoneerRemesas(texto) {
  exigir(texto, 'not your local currency')
  exigir(texto, '1% (minimum fee of 1.00 USD')
  exigir(texto, 'Annual card fee')
  exigir(texto, '29.95 USD')
  exigir(texto, 'Up to 1.8%')
  exigir(texto, 'Up to 3.5%')
  exigir(texto, '1.2%')

  return normalizarRemesa({
    compania: 'payoneer',
    cuentaPropia: true,
    moneda: 'FIAT',
    inversiones: false,
    tarjetaUsa: false,
    costoRecibirPagos: '1%',
    costoMantenimientoTarjeta: '29.95 USD',
    costoTarjeta: '1.8% a 3.5%',
    retiroArs: '1.2% a 4%',
    metodosRecepcion: ['ACH'],
    detalles: {
      costoRecibirPagos:
        '1% (mín. 1 USD) si la receiving account no está en tu moneda local. ACH bank debit en EE.UU.: 1%. En moneda local: gratis.',
      costoMantenimientoTarjeta:
        'Fee anual de la tarjeta: 29,95 USD. Fee anual de cuenta si recibís menos de 6.000 USD en 12 meses.',
      costoTarjeta:
        'Compras sin conversión: hasta 1,8%. Con conversión: hasta 3,5%.',
      retiroArs: 'Retiro a banco en moneda local del destinatario: 1,2% a 4%.',
      tarjetaUsa:
        'Payoneer publica tarjeta y fees en USD. La página de precios no dice que esté emitida en EE.UU.',
    },
  })
}

export const fuentePayoneerRemesas = {
  nombre: 'payoneer',
  url: 'https://www.payoneer.com/about/pricing/',
  mapear: mapearPayoneerRemesas,
}
