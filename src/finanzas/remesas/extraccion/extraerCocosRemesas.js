import { logMensaje, logError } from '@/log.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

const RENDIMIENTOS_TTY_URL = 'https://rendimientos.co/tty.js'

export function extraerRemesasDesdeJs(js) {
  const match = js.match(/const\s+REMESAS\s*=\s*(\[[\s\S]*?\]);/)

  if (!match || !match[1]) {
    throw new Error('No se encontró la constante REMESAS en tty.js')
  }

  return new Function(`return ${match[1]}`)()
}

export function mapearCocosDesdeRendimientos(cocosRaw) {
  const costoRecibirPagos = cocosRaw.fee != null ? `${cocosRaw.fee}%` : null

  const detalles = {}

  if (cocosRaw.feeMin != null) {
    detalles.costoRecibirPagos = `Mínimo ${cocosRaw.feeMin} USD`
  }

  if (cocosRaw.note) {
    detalles.costoRecibirPagos = detalles.costoRecibirPagos
      ? `${detalles.costoRecibirPagos}. ${cocosRaw.note}`
      : cocosRaw.note
  }

  return normalizarRemesa({
    compania: 'Cocos',
    cuentaPropia: cocosRaw.checking === true,
    moneda: 'FIAT',
    inversiones: cocosRaw.subnominada === true,
    tarjetaUsa: cocosRaw.card === true,
    costoRecibirPagos,
    costoMantenimientoTarjeta:
      cocosRaw.mantenimientoFree === true ? '0 USD' : null,
    costoTarjeta: '0%',
    retiroArs: '0',
    calificacionAndroid: null,
    calificacionIos: null,
    detalles: Object.keys(detalles).length > 0 ? detalles : null,
  })
}

export async function extraerCocosRemesas(log) {
  logMensaje(log, 'rendimientos.co: extrayendo Cocos remesas', {
    url: RENDIMIENTOS_TTY_URL,
  })

  const respuesta = await fetch(RENDIMIENTOS_TTY_URL)

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener tty.js: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  const js = await respuesta.text()
  const remesas = extraerRemesasDesdeJs(js)
  const cocos = remesas.find(r => r.name && r.name.toLowerCase() === 'cocos')

  if (!cocos) {
    throw new Error('No se encontró Cocos en REMESAS de rendimientos.co')
  }

  logMensaje(log, 'rendimientos.co: Cocos extraído', {
    name: cocos.name,
    fee: cocos.fee,
    feeMin: cocos.feeMin,
  })

  return mapearCocosDesdeRendimientos(cocos)
}
