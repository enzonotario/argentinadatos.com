import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearWallbitRemesas(texto) {
  exigir(texto, 'Depósitos (ACH, Wire, Moneda local, Cripto) Gratis')
  exigir(texto, 'Cuenta a tu nombre en Estados Unidos')
  exigir(texto, 'Tarjeta Visa')
  exigir(texto, '12.000 activos')
  exigir(texto, 'FX estándar')

  return normalizarRemesa({
    compania: 'wallbit',
    cuentaPropia: true,
    moneda: 'FIAT',
    inversiones: /12\.000 activos|cuenta remunerada/i.test(texto),
    tarjetaUsa: true,
    costoRecibirPagos: '0',
    costoMantenimientoTarjeta: '0 USD',
    costoTarjeta: '0%',
    retiroArs: 'FX',
    metodosRecepcion: ['ACH', 'Wire'],
    detalles: {
      costoRecibirPagos:
        'Depósitos ACH, Wire, moneda local y cripto gratis en el plan Classic.',
      costoMantenimientoTarjeta:
        'Plan Classic: 0 USD/mes. Emisión de tarjeta virtual: 5 USD, pago único.',
      costoTarjeta:
        'Uso en USD gratis. En otra moneda, sin comisión en USD o 2% FX.',
      retiroArs:
        'Retiro a moneda local con FX estándar. En algunos países hay 0,35 USD fijos por transacción.',
      tarjetaUsa: 'Tarjeta Visa Platinum de la cuenta en Estados Unidos.',
      inversiones: /2\.75%/i.test(texto)
        ? 'Cuenta remunerada desde 2,75% APR e inversiones en EE.UU.'
        : null,
    },
  })
}

export const fuenteWallbitRemesas = {
  nombre: 'wallbit',
  url: 'https://www.wallbit.io/es/pricing',
  mapear: mapearWallbitRemesas,
}
