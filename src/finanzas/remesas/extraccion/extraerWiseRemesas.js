import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearWiseRemesas(texto) {
  exigir(texto, 'Receiving domestic payments')
  exigir(texto, 'USD Free')
  exigir(texto, '6.11 USD')

  return normalizarRemesa({
    compania: 'wise',
    cuentaPropia: false,
    moneda: 'FIAT',
    inversiones: false,
    tarjetaUsa: false,
    costoRecibirPagos: '0',
    costoMantenimientoTarjeta: null,
    costoTarjeta: null,
    retiroArs: null,
    metodosRecepcion: ['ACH', 'Wire', 'SWIFT'],
    detalles: {
      cuentaPropia:
        'Wise da datos de cuenta para cobrar. No es una cuenta bancaria propia en EE.UU.',
      costoRecibirPagos:
        'Pagos domésticos (ACH, no wire) gratis. Wire o SWIFT en USD: 6,11 USD.',
      tarjetaUsa:
        'La página de cobros no publica una tarjeta emitida en EE.UU.',
    },
  })
}

export const fuenteWiseRemesas = {
  nombre: 'wise',
  url: 'https://wise.com/us/pricing/receive',
  mapear: mapearWiseRemesas,
}
