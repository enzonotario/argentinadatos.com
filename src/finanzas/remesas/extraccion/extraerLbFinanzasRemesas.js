import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearLbFinanzasRemesas(texto) {
  exigir(texto, '0.5% + 5 USD')
  exigir(texto, '0.5% + 35 USD')
  exigir(texto, '15 USDT')
  exigir(texto, 'Zenus Bank')
  exigir(texto, 'Dolar crypto')

  return normalizarRemesa({
    compania: 'lbfinanzas',
    cuentaPropia: true,
    moneda: 'FIAT',
    inversiones: /rendimientos/i.test(texto),
    tarjetaUsa: false,
    costoRecibirPagos: '0.5% + 5 USD',
    costoMantenimientoTarjeta: null,
    costoTarjeta: null,
    retiroArs: 'FX',
    detalles: {
      cuentaPropia:
        'Cuenta en dólares en EE.UU. a tu nombre vía Zenus Bank International. LB Finanzas no es un banco.',
      costoRecibirPagos:
        'ACH: 0,5% + 5 USD. Wire o SWIFT: 0,5% + 35 USD. Apertura: 15 USDT anuales; sin mantenimiento según la página de cuenta.',
      tarjetaUsa:
        'La página de cuenta en EE.UU. no publica una tarjeta emitida en Estados Unidos.',
      retiroArs:
        'Cambio a ARS al dólar crypto. Cambio a USDC: 0,75%.',
      inversiones:
        'Podés mantener saldo en dólares con rendimientos e invertir desde la plataforma.',
    },
  })
}

export const fuenteLbFinanzasRemesas = {
  nombre: 'lbfinanzas',
  url: 'https://lbfinanzas.com/cuenta-en-eeuu',
  mapear: mapearLbFinanzasRemesas,
}
