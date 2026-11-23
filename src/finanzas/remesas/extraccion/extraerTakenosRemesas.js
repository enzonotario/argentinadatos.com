import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearTakenosRemesas(texto) {
  exigir(texto, 'transferencias ACH')
  exigir(texto, 'totalmente gratis')
  exigir(texto, '25 USD')
  exigir(texto, 'comisión del 1%')
  exigir(texto, 'totalmente gratuitos')

  return normalizarRemesa({
    compania: 'takenos',
    cuentaPropia: true,
    moneda: 'CRIPTO',
    inversiones: /inversiones/i.test(texto),
    tarjetaUsa: /takecard/i.test(texto),
    costoRecibirPagos: '0',
    costoMantenimientoTarjeta: '0 USD',
    costoTarjeta: '1%',
    retiroArs: '0',
    metodosRecepcion: ['ACH', 'Wire'],
    detalles: {
      moneda: 'Los pagos se acreditan como USD digital.',
      costoRecibirPagos: 'ACH en USD gratis. Wire en USD: 25 USD.',
      costoTarjeta:
        'TakeCard: 1% por compra. Spicy Card: sin comisión de gasto.',
      retiroArs: 'Retiros en ARS a cuenta bancaria argentina gratis.',
      tarjetaUsa: 'TakeCard para compras internacionales con USD digital.',
    },
  })
}

export const fuenteTakenosRemesas = {
  nombre: 'takenos',
  url: 'https://takenos.com/blog/takenos-y-sus-comisiones-cu%C3%A1les-son-los-costos-y-comisiones-de-takenos',
  mapear: mapearTakenosRemesas,
}
