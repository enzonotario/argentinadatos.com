import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearGrabrfiRemesas(texto) {
  exigir(texto, 'Same-day incoming ACH $0')
  exigir(texto, 'Standard incoming ACH $0')
  exigir(texto, 'Monthly maintenance $0')
  exigir(texto, 'Argentina $5')
  exigir(texto, 'issued by Lead Bank')

  return normalizarRemesa({
    compania: 'grabrfi',
    cuentaPropia: true,
    moneda: /USDC/i.test(texto) ? 'CRIPTO' : 'FIAT',
    inversiones: false,
    tarjetaUsa: true,
    costoRecibirPagos: '0',
    costoMantenimientoTarjeta: '0 USD',
    costoTarjeta: '0%',
    retiroArs: '5 USD',
    metodosRecepcion: ['ACH', 'Wire'],
    detalles: {
      moneda:
        'El saldo de la cuenta global está en dólares digitales (USDB o USDC).',
      costoRecibirPagos:
        'ACH entrante: 0 USD. Wire doméstico entrante en EE.UU.: 15 USD.',
      costoTarjeta: 'Compras en EE.UU. gratis. Compras fuera de EE.UU.: 1,5%.',
      retiroArs: 'Retiro a moneda local en Argentina: 5 USD.',
      tarjetaUsa: 'Visa prepaga emitida por Lead Bank (EE.UU.).',
      inversiones:
        'Boost es un incentivo promocional, no un producto de inversión.',
    },
  })
}

export const fuenteGrabrfiRemesas = {
  nombre: 'grabrfi',
  url: 'https://help.grabrfi.com/en/content/full-schedule-of-fees',
  mapear: mapearGrabrfiRemesas,
}
