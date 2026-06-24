import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logMensaje, logError, logGrupo } from '@/log.js'
import { extraerCocosRemesas } from '@/finanzas/remesas/extraccion/extraerCocosRemesas.js'

const REMESAS_URL = 'https://www.dolarito.ar/remotito'
const PREFIJO_NEXT_PUSH = 'self.__next_f.push('

const ALIAS_COMPANIA_REMESA = {
  global666: 'global66',
}

const CAMPOS_CON_DETALLE = [
  'cuentaPropia',
  'moneda',
  'inversiones',
  'tarjetaUsa',
  'costoRecibirPagos',
  'costoMantenimientoTarjeta',
  'costoTarjeta',
  'retiroArs',
  'calificacionAndroid',
  'calificacionIos',
]

const schema = {
  remesas: {
    type: 'array',
    description: 'Filas de la tabla de comparación de plataformas de cobro',
    items: {
      type: 'object',
      properties: {
        compania: {
          type: 'string',
          description: 'Nombre de la compañía',
        },
        cuentaPropia: {
          type: 'boolean',
          description: 'Tiene cuenta propia (Sí=true, No=false)',
        },
        moneda: {
          type: 'string',
          description: 'Moneda: FIAT o CRIPTO',
        },
        inversiones: {
          type: 'boolean',
          description: 'Permite inversiones',
        },
        tarjetaUsa: {
          type: 'boolean',
          description: 'Ofrece tarjeta emitida en EEUU',
        },
        costoRecibirPagos: {
          type: 'string',
          description: 'Costo por recibir pagos (ej. 0, 1%, 3 USD)',
        },
        costoMantenimientoTarjeta: {
          type: 'string',
          description:
            'Costo de mantenimiento de tarjeta (ej. 0 USD, 29,95 USD)',
        },
        costoTarjeta: {
          type: 'string',
          description: 'Costo de uso de tarjeta (ej. 0%, 1% a 3%)',
        },
        retiroArs: {
          type: 'string',
          description: 'Costo de retiro en ARS (ej. 0, 2%, 1%)',
        },
        calificacionAndroid: {
          type: 'number',
          description: 'Puntaje en Google Play Store (ej. 4.7)',
        },
        calificacionIos: {
          type: 'number',
          description: 'Puntaje en App Store (ej. 4.8)',
        },
        detalles: {
          type: 'object',
          description: 'Aclaraciones o tooltips por columna cuando existan',
          properties: {
            cuentaPropia: {
              type: 'string',
              description: 'Detalle adicional de cuenta propia',
            },
            moneda: {
              type: 'string',
              description: 'Detalle adicional de moneda',
            },
            inversiones: {
              type: 'string',
              description: 'Detalle adicional de inversiones',
            },
            tarjetaUsa: {
              type: 'string',
              description: 'Detalle adicional de tarjeta USA',
            },
            costoRecibirPagos: {
              type: 'string',
              description: 'Detalle adicional de costo por recibir pagos',
            },
            costoMantenimientoTarjeta: {
              type: 'string',
              description:
                'Detalle adicional de costo de mantenimiento de tarjeta',
            },
            costoTarjeta: {
              type: 'string',
              description: 'Detalle adicional de costo de uso de tarjeta',
            },
            retiroArs: {
              type: 'string',
              description: 'Detalle adicional de retiro en ARS',
            },
            calificacionAndroid: {
              type: 'string',
              description: 'Detalle adicional de review Android',
            },
            calificacionIos: {
              type: 'string',
              description: 'Detalle adicional de review iOS',
            },
          },
        },
      },
      required: ['compania'],
    },
  },
}

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

function combinarDetallesRemesa(...detalleSets) {
  return normalizarDetallesRemesa(
    Object.assign({}, ...detalleSets.filter(Boolean)),
  )
}

export function normalizarRemesa(raw) {
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
    detalles: normalizarDetallesRemesa(raw.detalles || raw.extras),
    calificacionAndroid:
      typeof raw.calificacionAndroid === 'number'
        ? raw.calificacionAndroid
        : null,
    calificacionIos:
      typeof raw.calificacionIos === 'number' ? raw.calificacionIos : null,
  }
}

export function parsearRemesasDesdeHtml(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  const scriptConDatos = scripts
    .map(([, contenido]) => contenido.trim())
    .find(
      contenido =>
        contenido.includes('serviceResponse') && contenido.includes('company'),
    )

  if (!scriptConDatos) {
    throw new Error('No se encontró script con datos estructurados de remesas')
  }

  if (!scriptConDatos.startsWith(PREFIJO_NEXT_PUSH)) {
    throw new Error('Formato inesperado del script de remesas')
  }

  const argumentoPush = scriptConDatos
    .slice(PREFIJO_NEXT_PUSH.length)
    .replace(/;?\)\s*$/, '')

  const payloadPush = JSON.parse(argumentoPush)
  const payloadSerializado = payloadPush[1]

  if (typeof payloadSerializado !== 'string') {
    throw new Error('Payload de remesas inválido en script Next.js')
  }

  const indiceSeparador = payloadSerializado.indexOf(':')

  if (indiceSeparador < 0) {
    throw new Error('No se pudo ubicar el prefijo del payload de remesas')
  }

  const payload = JSON.parse(payloadSerializado.slice(indiceSeparador + 1))

  const datos = payload?.[3]?.serviceResponse?.data

  if (!Array.isArray(datos)) {
    throw new Error('Payload estructurado de remesas sin array data')
  }

  return datos
}

function mapearRemesaDesdeHtml(raw) {
  return normalizarRemesa({
    compania: raw.company,
    cuentaPropia: raw.ownAccount?.value,
    moneda: raw.currency,
    inversiones: raw.investments?.value,
    tarjetaUsa: raw.usaCard?.value,
    costoRecibirPagos: raw.receivePaymentsCost?.description,
    costoMantenimientoTarjeta: raw.cardMaintenanceCost?.description,
    costoTarjeta: raw.cardUseCost?.description,
    retiroArs: raw.arsWithdrawal?.description,
    detalles: {
      cuentaPropia: raw.ownAccount?.popup,
      moneda: raw.currencyPopup,
      inversiones: raw.investments?.popup,
      tarjetaUsa: raw.usaCard?.popup,
      costoRecibirPagos: raw.receivePaymentsCost?.popup,
      costoMantenimientoTarjeta: raw.cardMaintenanceCost?.popup,
      costoTarjeta: raw.cardUseCost?.popup,
      retiroArs: raw.arsWithdrawal?.popup,
      calificacionAndroid: raw.appScore?.android?.popup,
      calificacionIos: raw.appScore?.ios?.popup,
    },
    calificacionAndroid: raw.appScore?.android?.rating,
    calificacionIos: raw.appScore?.ios?.rating,
  })
}

async function extraerRemesasDesdeHtml(log) {
  logMensaje(log, 'HTML estructurado: dolarito.ar/remotito', {
    url: REMESAS_URL,
  })

  const respuesta = await fetch(REMESAS_URL)

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener HTML de remesas: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  const html = await respuesta.text()

  return parsearRemesasDesdeHtml(html).map(mapearRemesaDesdeHtml)
}

export function enriquecerRemesasConDetalles(remesasBase, remesasDesdeHtml) {
  const remesasPorCompania = new Map(
    remesasDesdeHtml
      .filter(Boolean)
      .map(remesa => [remesa.compania?.toLowerCase(), remesa]),
  )

  return remesasBase.map(remesa => {
    const remesaHtml = remesasPorCompania.get(remesa.compania?.toLowerCase())

    if (!remesaHtml) {
      return remesa
    }

    return {
      ...remesa,
      detalles: combinarDetallesRemesa(remesa.detalles, remesaHtml.detalles),
    }
  })
}

async function extraerFilasRemesas(log) {
  const configuracion = {
    url: REMESAS_URL,
    prompt: `Extrae todas las filas de la tabla comparativa de plataformas para cobrar pagos del exterior.
Columnas de la tabla:
1. Compañia: nombre de la plataforma
2. Cuenta propia: tiene cuenta propia (Sí/No)
3. Moneda: FIAT o CRIPTO
4. Inversiones: permite inversiones (Sí/No)
5. Tarjeta USA: tarjeta emitida en EEUU (Sí/No)
6. Costo recibir pagos: costo de recibir pagos (ej. "0", "1%", "3 USD")
7. Costo mant. tarjeta: costo de mantenimiento de tarjeta (ej. "0 USD", "29,95 USD")
8. Costo uso tarjeta: costo de uso de tarjeta (ej. "0%", "1% a 3%")
9. Retiro ARS: costo de retiro de ARS (ej. "0", "2%", "1%")
10. Review Android: puntaje en Google Play
11. Review iOS: puntaje en App Store
Si una celda tiene texto explicativo como "No tiene tarjeta emitida en EEUU.", deja el campo correspondiente como string con ese texto.
Si una celda tiene un ícono de información, tooltip o aclaración adicional, extrae el valor principal en su columna normal y guarda la aclaración en "detalles.<columna>".
Ejemplo Takenos:
- costoRecibirPagos: "0"
- detalles.costoRecibirPagos: "Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD"`,
    schema,
    required: ['remesas'],
  }

  logMensaje(log, 'Firecrawl: dolarito.ar/remotito', {
    url: REMESAS_URL,
  })

  const [resultadoFirecrawl, resultadoHtml] = await Promise.allSettled([
    scrapeWithFirecrawl(log, configuracion),
    extraerRemesasDesdeHtml(log),
  ])

  if (
    resultadoFirecrawl.status === 'fulfilled' &&
    resultadoFirecrawl.value &&
    Array.isArray(resultadoFirecrawl.value.remesas)
  ) {
    const remesas = resultadoFirecrawl.value.remesas.map(normalizarRemesa)

    if (resultadoHtml.status === 'fulfilled') {
      return enriquecerRemesasConDetalles(remesas, resultadoHtml.value)
    }

    return remesas
  }

  if (resultadoHtml.status === 'fulfilled') {
    logMensaje(log, 'extraerRemesas: usando fallback HTML estructurado', {
      motivo:
        resultadoFirecrawl.status === 'rejected'
          ? resultadoFirecrawl.reason?.message
          : 'Firecrawl sin array remesas',
    })

    return resultadoHtml.value
  }

  if (resultadoFirecrawl.status === 'rejected') {
    throw resultadoFirecrawl.reason
  }

  throw new Error(
    'Firecrawl Remesas: respuesta sin array remesas y fallback HTML falló',
  )
}

export async function extraerRemesas() {
  const log = logGrupo({
    fuente: 'extraerRemesas',
    tipo: 'remesas',
  })

  try {
    const [resultadoPrincipal, resultadoCocos] = await Promise.allSettled([
      extraerFilasRemesas(log),
      extraerCocosRemesas(log),
    ])

    const remesas =
      resultadoPrincipal.status === 'fulfilled' ? resultadoPrincipal.value : []

    if (resultadoCocos.status === 'fulfilled') {
      remesas.push(resultadoCocos.value)
      logMensaje(log, 'extraerRemesas: Cocos desde rendimientos.co agregado')
    } else {
      logError(log, resultadoCocos.reason)
      logMensaje(log, 'extraerRemesas: falló Cocos desde rendimientos.co', {
        errorMessage: resultadoCocos.reason?.message,
      })
    }

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
