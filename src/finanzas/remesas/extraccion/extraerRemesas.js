import { logMensaje, logError, logGrupo } from '@/log.js'
import { extraerCocosRemesas } from '@/finanzas/remesas/extraccion/extraerCocosRemesas.js'
import { extraerBeloRemesas } from '@/finanzas/remesas/extraccion/extraerBeloRemesas.js'
import { extraerRipioRemesas } from '@/finanzas/remesas/extraccion/extraerRipioRemesas.js'
import { extraerFuentesDirectasRemesas } from '@/finanzas/remesas/extraccion/extraerRemesasDirectas.js'
import { extraerAstropayRemesas } from '@/finanzas/remesas/extraccion/extraerAstropayRemesas.js'
import { extraerGlobal66Remesas } from '@/finanzas/remesas/extraccion/extraerGlobal66Remesas.js'
import { extraerLemonRemesas } from '@/finanzas/remesas/extraccion/extraerLemonRemesas.js'
import { extraerArqRemesas } from '@/finanzas/remesas/extraccion/extraerArqRemesas.js'
import { extraerRemesasDolarito } from '@/finanzas/remesas/extraccion/extraerRemesasDolarito.js'

const ALIAS_COMPANIA_REMESA = {
  global666: 'global66',
}

export const METODOS_RECEPCION = ['ACH', 'Wire', 'SWIFT']

const CAMPOS_CON_DETALLE = [
  'cuentaPropia',
  'moneda',
  'inversiones',
  'tarjetaUsa',
  'costoRecibirPagos',
  'costoMantenimientoTarjeta',
  'costoTarjeta',
  'retiroArs',
  'metodosRecepcion',
  'calificacionAndroid',
  'calificacionIos',
]

function normalizarBooleano(valor) {
  return valor === true || valor === 'Si' || valor === 'Sí' || valor === true
}

function normalizarTexto(valor) {
  if (typeof valor !== 'string') {
    return valor ?? null
  }

  const texto = valor.trim()

  return texto || null
}

export function normalizarCompaniaRemesa(compania) {
  const texto = normalizarTexto(compania)

  if (!texto) {
    return null
  }

  const clave = texto.toLowerCase()

  return ALIAS_COMPANIA_REMESA[clave] ?? texto
}

export function normalizarDetallesRemesa(rawDetalles) {
  if (
    !rawDetalles ||
    typeof rawDetalles !== 'object' ||
    Array.isArray(rawDetalles)
  ) {
    return null
  }

  const detalles = {}

  for (const campo of CAMPOS_CON_DETALLE) {
    const valor = normalizarTexto(rawDetalles[campo])

    if (valor) {
      detalles[campo] = valor
    }
  }

  return Object.keys(detalles).length > 0 ? detalles : null
}

export function normalizarMetodosRecepcion(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null
  }

  const vistos = new Set()

  for (const item of raw) {
    const texto = String(item || '')
      .trim()
      .toLowerCase()

    if (texto === 'ach') vistos.add('ACH')
    else if (texto === 'wire') vistos.add('Wire')
    else if (texto === 'swift') vistos.add('SWIFT')
  }

  const metodos = METODOS_RECEPCION.filter(metodo => vistos.has(metodo))

  return metodos.length > 0 ? metodos : null
}

/** Detecta ACH / Wire / SWIFT mencionados en prosa oficial. */
export function detectarMetodosRecepcionDesdeTexto(...textos) {
  const unido = textos
    .filter(Boolean)
    .map(texto => String(texto))
    .join(' ')
    .toLowerCase()

  if (!unido.trim()) {
    return null
  }

  const metodos = []

  if (/\bach\b/.test(unido)) metodos.push('ACH')
  if (/\bwire\b/.test(unido)) metodos.push('Wire')
  if (/\bswift\b/.test(unido)) metodos.push('SWIFT')

  return metodos.length > 0 ? metodos : null
}

export function normalizarRemesa(raw) {
  const metodosExplicitos = normalizarMetodosRecepcion(raw.metodosRecepcion)
  const metodosDetectados =
    metodosExplicitos ||
    detectarMetodosRecepcionDesdeTexto(
      raw.costoRecibirPagos,
      raw.detalles?.costoRecibirPagos || raw.extras?.costoRecibirPagos,
      raw.detalles?.cuentaPropia || raw.extras?.cuentaPropia,
      raw.detalles?.metodosRecepcion || raw.extras?.metodosRecepcion,
    )

  return {
    compania: normalizarCompaniaRemesa(raw.compania),
    cuentaPropia: normalizarBooleano(raw.cuentaPropia),
    moneda: normalizarTexto(raw.moneda),
    inversiones: normalizarBooleano(raw.inversiones),
    tarjetaUsa: normalizarBooleano(raw.tarjetaUsa),
    costoRecibirPagos: normalizarTexto(raw.costoRecibirPagos),
    costoMantenimientoTarjeta: normalizarTexto(raw.costoMantenimientoTarjeta),
    costoTarjeta: normalizarTexto(raw.costoTarjeta),
    retiroArs: normalizarTexto(raw.retiroArs),
    metodosRecepcion: metodosDetectados,
    detalles: normalizarDetallesRemesa(raw.detalles || raw.extras),
    calificacionAndroid:
      typeof raw.calificacionAndroid === 'number'
        ? raw.calificacionAndroid
        : null,
    calificacionIos:
      typeof raw.calificacionIos === 'number' ? raw.calificacionIos : null,
  }
}

export function reemplazarRemesa(remesas, remesa) {
  const clave = remesa?.compania?.toLowerCase()

  if (!clave) return

  const indice = remesas.findIndex(
    item => item.compania?.toLowerCase() === clave,
  )

  if (indice >= 0) remesas[indice] = remesa
  else remesas.push(remesa)
}

function agregarRemesaOpcional(
  log,
  remesas,
  resultado,
  { nombre, exito, fallo },
) {
  if (resultado.status === 'fulfilled') {
    reemplazarRemesa(remesas, resultado.value)
    logMensaje(log, exito, { compania: nombre })
    return
  }

  logError(log, resultado.reason)
  logMensaje(log, fallo, {
    errorMessage: resultado.reason?.message,
  })
}

export async function extraerRemesas() {
  const log = logGrupo({
    fuente: 'extraerRemesas',
    tipo: 'remesas',
  })

  try {
    const [
      resultadoPrincipal,
      resultadoCocos,
      resultadoBelo,
      resultadoRipio,
      resultadoDirectas,
      resultadoAstropay,
      resultadoGlobal66,
      resultadoLemon,
      resultadoArq,
    ] = await Promise.allSettled([
      extraerRemesasDolarito(log),
      extraerCocosRemesas(log),
      extraerBeloRemesas(log),
      extraerRipioRemesas(log),
      extraerFuentesDirectasRemesas(log),
      extraerAstropayRemesas(log),
      extraerGlobal66Remesas(log),
      extraerLemonRemesas(log),
      extraerArqRemesas(log),
    ])

    const remesas =
      resultadoPrincipal.status === 'fulfilled' ? resultadoPrincipal.value : []

    if (resultadoDirectas.status === 'fulfilled') {
      for (const fuente of resultadoDirectas.value) {
        if (!fuente.ok) continue

        reemplazarRemesa(remesas, fuente.remesa)
        logMensaje(
          log,
          `extraerRemesas: ${fuente.remesa.compania} desde fuente oficial`,
        )
      }
    } else {
      logError(log, resultadoDirectas.reason)
      logMensaje(log, 'extraerRemesas: falló el lote de fuentes oficiales', {
        errorMessage: resultadoDirectas.reason?.message,
      })
    }

    if (resultadoCocos.status === 'fulfilled') {
      reemplazarRemesa(remesas, resultadoCocos.value)
      logMensaje(log, 'extraerRemesas: Cocos desde rendimientos.co agregado')
    } else {
      logError(log, resultadoCocos.reason)
      logMensaje(log, 'extraerRemesas: falló Cocos desde rendimientos.co', {
        errorMessage: resultadoCocos.reason?.message,
      })
    }

    agregarRemesaOpcional(log, remesas, resultadoBelo, {
      nombre: 'Belo',
      exito: 'extraerRemesas: Belo desde belo.app agregado',
      fallo: 'extraerRemesas: falló Belo desde belo.app',
    })

    agregarRemesaOpcional(log, remesas, resultadoRipio, {
      nombre: 'Ripio',
      exito: 'extraerRemesas: Ripio desde ripio.com agregado',
      fallo: 'extraerRemesas: falló Ripio desde ripio.com',
    })

    agregarRemesaOpcional(log, remesas, resultadoAstropay, {
      nombre: 'AstroPay',
      exito: 'extraerRemesas: AstroPay desde astropay.com agregado',
      fallo: 'extraerRemesas: falló AstroPay desde astropay.com',
    })

    agregarRemesaOpcional(log, remesas, resultadoGlobal66, {
      nombre: 'Global66',
      exito: 'extraerRemesas: Global66 desde global66.com agregado',
      fallo: 'extraerRemesas: falló Global66 desde global66.com',
    })

    agregarRemesaOpcional(log, remesas, resultadoLemon, {
      nombre: 'Lemon',
      exito: 'extraerRemesas: Lemon desde lemon.me agregado',
      fallo: 'extraerRemesas: falló Lemon desde lemon.me',
    })

    agregarRemesaOpcional(log, remesas, resultadoArq, {
      nombre: 'arq',
      exito: 'extraerRemesas: ARQ desde arqfinance.com agregado',
      fallo: 'extraerRemesas: falló ARQ desde arqfinance.com',
    })

    if (remesas.length === 0 && resultadoPrincipal.status === 'rejected') {
      throw resultadoPrincipal.reason
    }

    return {
      fechaActualizacion: new Date().toISOString(),
      remesas,
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'extraerRemesas: falló extracción', {
      errorMessage: error.message,
    })
    return {
      fechaActualizacion: new Date().toISOString(),
      remesas: [],
      errorExtraccion: error.message,
    }
  }
}
