import { logMensaje } from '@/log.js'
import { htmlATexto } from '@/finanzas/remesas/extraccion/extraerRemesasDirectas.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'
import { enriquecerRemesaConCalificaciones } from '@/finanzas/remesas/extraccion/stores/obtenerCalificacionesAppStores.js'

const FUENTES_ASTROPAY_REMESAS = [
  {
    nombre: 'tarjetas',
    url: 'https://www.astropay.com/es/tarjetas',
  },
  {
    nombre: 'tarjeta-argentina',
    url: 'https://www.astropay.com/es/rest-of-the-world/cards-argentina',
  },
  {
    nombre: 'cuenta-usd',
    url: 'https://www.astropay.com/es/rest-of-the-world/usd-accounts',
  },
]

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearAstropayRemesas(texto) {
  exigir(texto, 'Emitida en el exterior')
  exigir(texto, 'sin costo')
  exigir(texto, 'Costo de emisión de la primera tarjeta')
  exigir(texto, 'Costo de mantenimiento, renovación y cierre de cuenta')
  exigir(texto, 'Costo por consumos con la tarjeta')
  exigir(texto, '0 ARS')
  exigir(texto, 'no devengan intereses')
  exigir(texto, 'no es una cuenta personal')
  exigir(texto, 'ACH')
  exigir(texto, 'no recibirá intereses')

  return normalizarRemesa({
    compania: 'AstroPay',
    cuentaPropia: false,
    moneda: 'FIAT',
    inversiones: false,
    tarjetaUsa: true,
    costoRecibirPagos: null,
    costoMantenimientoTarjeta: '0 ARS',
    costoTarjeta: '0 ARS',
    retiroArs: null,
    metodosRecepcion: ['ACH', 'Wire', 'SWIFT'],
    detalles: {
      cuentaPropia:
        'AstroPay da instrucciones ACH, SWIFT o Wire a nombre del usuario. La cuenta en USD no es una cuenta personal: es una cuenta FBO agrupada.',
      costoRecibirPagos:
        'Las páginas oficiales no publican un porcentaje fijo por recibir ACH, SWIFT o Wire. Las comisiones de transferencia pueden variar y se muestran en la app.',
      costoMantenimientoTarjeta:
        'Anexo de la tarjeta en Argentina: emisión de la primera virtual, mantenimiento, renovación y cierre, 0 ARS.',
      costoTarjeta:
        'Anexo de la tarjeta en Argentina: consumos, 0 ARS. La página de tarjetas dice que la virtual sale sin costo.',
      retiroArs:
        'Retiro por cajero en Argentina: 0 ARS. Un retiro bancario en una moneda distinta de USD se convierte al tipo de cambio de la app, a costo del usuario. No publican un porcentaje fijo.',
      tarjetaUsa: 'AstroCard Global, emitida en el exterior.',
      inversiones:
        'Los términos dicen que el saldo no devenga intereses para el usuario. El rendimiento del programa de efectivo de la cuenta en custodia queda para AstroPay.',
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

export async function extraerAstropayRemesas(log) {
  const textos = await Promise.all(
    FUENTES_ASTROPAY_REMESAS.map(async (fuente) => {
      logMensaje(log, `Fuente oficial: astropay ${fuente.nombre}`, {
        url: fuente.url,
      })

      return obtenerTexto(fuente.url)
    }),
  )

  return enriquecerRemesaConCalificaciones(
    log,
    mapearAstropayRemesas(textos.join('\n')),
  )
}
