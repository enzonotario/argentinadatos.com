import { logMensaje } from '@/log.js'
import { htmlATexto } from '@/finanzas/remesas/extraccion/extraerRemesasDirectas.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

const FUENTES_ARQ_REMESAS = [
  {
    nombre: 'costos',
    url: 'https://www.arqfinance.com/en-AR/help/articles/arq-costs-and-fees-argentina',
  },
  {
    nombre: 'tarjetas',
    url: 'https://www.arqfinance.com/en-AR/help/articles/understanding-the-difference-between-global-and-local-cards-argentina',
  },
  {
    nombre: 'wire',
    url: 'https://www.arqfinance.com/en-AR/help/articles/how-can-i-make-wire-transfers-to-arq',
  },
  {
    nombre: 'cuenta-usd',
    url: 'https://www.arqfinance.com/en-AR/help/articles/how-to-send-and-receive-payments-from-the-us',
  },
]

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearArqRemesas(texto) {
  exigir(texto, 'residence address in Argentina')
  exigir(texto, '3 USDc fee when depositing funds from US dollar accounts')
  exigir(texto, 'Virtual ARQ')
  exigir(texto, 'without any charge')
  exigir(texto, 'without fees')
  exigir(texto, '5% commission')
  exigir(texto, 'ATM withdrawals')
  exigir(texto, '2.99 USDc')
  exigir(texto, '2,000.00 ARS')
  exigir(texto, 'issued outside Argentina')
  exigir(texto, 'Card issued in Argentina')
  exigir(texto, 'Beneficiary name')
  exigir(texto, 'Your name')
  exigir(texto, 'Checking account')
  exigir(texto, 'Lead Bank')
  exigir(texto, 'your own US account details')
  exigir(texto, '$3 USD per transaction')
  exigir(texto, 'earn rewards')

  return normalizarRemesa({
    compania: 'arq',
    cuentaPropia: true,
    moneda: 'CRIPTO',
    inversiones: true,
    tarjetaUsa: true,
    costoRecibirPagos: '3 USD',
    costoMantenimientoTarjeta: '0 USD',
    costoTarjeta: '0%',
    retiroArs: '0',
    metodosRecepcion: ['ACH', 'Wire'],
    detalles: {
      cuentaPropia:
        'Para un wire, el beneficiario es tu nombre, en una cuenta checking de Lead Bank. Recibir o enviar con esos datos de EE.UU. cuesta 3 USD por operación y se acredita en dólares digitales.',
      costoRecibirPagos:
        'Depósito desde cuentas en dólares: 3 USDc. Lo mismo al usar los datos de cuenta de EE.UU. El plan Standard es el de estas cifras; Premium cambia algunas.',
      costoMantenimientoTarjeta:
        'La virtual no tiene cargo. En el plan Standard, la física global sale 2,99 USDc y la local 2.000 ARS.',
      costoTarjeta:
        'Los pagos con ARQCard no tienen cargo. Si el comercio cobra en pesos argentinos: 5%.',
      retiroArs:
        'Transferencias en moneda local sin cargo. La extracción en cajero es 1% y no es el retiro a un banco.',
      tarjetaUsa:
        'La Global está emitida fuera de Argentina y gasta dólares digitales. Una tarjeta global cuenta como tarjeta de EE.UU. La Local está emitida en Argentina y gasta pesos.',
      inversiones:
        'Guardar dólares digitales y sumar rewards no tiene costo extra.',
    },
  })
}

async function obtenerTexto(url) {
  const respuesta = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ArgentinaDatos/1.0)',
      accept: 'text/html',
    },
  })

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener ${url}: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  return htmlATexto(await respuesta.text())
}

export async function extraerArqRemesas(log) {
  const textos = await Promise.all(
    FUENTES_ARQ_REMESAS.map(async (fuente) => {
      logMensaje(log, `Fuente oficial: arq ${fuente.nombre}`, {
        url: fuente.url,
      })

      return obtenerTexto(fuente.url)
    }),
  )

  return mapearArqRemesas(textos.join('\n'))
}
