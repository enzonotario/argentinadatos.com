import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logMensaje } from '@/log.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

export const BELO_REMESAS_FUENTES = [
  {
    key: 'tarjeta',
    url: 'https://www.belo.app/ar/tarjeta-internacional',
  },
  {
    key: 'cuentaUsd',
    url: 'https://help.belo.app/es/articles/5705712-como-ingresar-dolares-a-tu-cuenta-belo-ach-payoneer-y-airtm',
  },
  {
    key: 'lux',
    url: 'https://www.belo.app/lux',
  },
]

const schema = {
  compania: {
    type: 'string',
    description: 'Nombre de la compañía (Belo)',
  },
  cuentaPropia: {
    type: 'boolean',
    description:
      'Tiene cuenta propia en dólares (ACH/Wire) u otra cuenta bancaria propia',
  },
  moneda: {
    type: 'string',
    description:
      'FIAT si acredita dólares fiat; CRIPTO si acredita USDC/USDT u otra cripto',
  },
  inversiones: {
    type: 'boolean',
    description: 'Permite inversiones o rendimientos',
  },
  tarjetaUsa: {
    type: 'boolean',
    description:
      'Ofrece tarjeta emitida en el exterior/EEUU (p. ej. Visa Global / belo LUX)',
  },
  costoRecibirPagos: {
    type: 'string',
    description: 'Comisión principal por recibir pagos (ej. 0.5%, 0)',
  },
  costoMantenimientoTarjeta: {
    type: 'string',
    description: 'Costo de mantenimiento de tarjeta (ej. 0 USD)',
  },
  costoTarjeta: {
    type: 'string',
    description: 'Costo de uso de tarjeta internacional (ej. 0%)',
  },
  retiroArs: {
    type: 'string',
    description: 'Costo de retiro/conversión a ARS (no ATM)',
  },
  detalles: {
    type: 'object',
    description: 'Aclaraciones por columna',
    properties: {
      cuentaPropia: { type: 'string' },
      moneda: { type: 'string' },
      inversiones: { type: 'string' },
      tarjetaUsa: { type: 'string' },
      costoRecibirPagos: { type: 'string' },
      costoMantenimientoTarjeta: { type: 'string' },
      costoTarjeta: { type: 'string' },
      retiroArs: { type: 'string' },
    },
  },
}

const prompt = `Extraé atributos de belo para una tabla comparativa de remesas/cobro del exterior en Argentina.
Campos:
- compania: "Belo"
- cuentaPropia: true si permite abrir cuenta en dólares propia (ACH/Wire)
- moneda: "CRIPTO" si los fondos se acreditan como USDC/USDT/cripto; "FIAT" solo si acredita dólares fiat
- inversiones: true solo si la página menciona rendimientos/inversiones
- tarjetaUsa: true si menciona tarjeta emitida en el exterior (Visa Global / belo LUX / USA)
- costoRecibirPagos: comisión ACH principal (ej. "0.5%"); no inventes "0" ni "No" si no hay dato
- costoMantenimientoTarjeta: costo mensual/mantenimiento de tarjeta (ej. "0 USD"); no confundir con apertura de cuenta
- costoTarjeta: costo de uso de la tarjeta internacional en USD (ej. "0%")
- retiroArs: costo de transferir/convertir a ARS a cuenta bancaria (no extracción ATM)
- detalles: aclaraciones por campo (mínimos ACH/Wire, apertura de cuenta USD, LUX vs Mastercard local, etc.)
Solo usá información explícita de la página. Si un dato no aparece, dejalo null (no "No", no "Free", no "null" como string).`

function textoDe(...valores) {
  return valores
    .flatMap(valor => {
      if (valor == null) return []
      if (typeof valor === 'string') return [valor]
      if (typeof valor === 'object') return Object.values(valor)
      return [String(valor)]
    })
    .filter(Boolean)
    .join(' ')
}

function esVacioOBasura(valor) {
  if (valor == null) return true
  if (typeof valor !== 'string') return false

  const normalizado = valor.trim().toLowerCase()

  return (
    !normalizado ||
    ['null', 'undefined', 'no', 'n/a', 'na', 'free', 'none', '-'].includes(
      normalizado,
    )
  )
}

function normalizarTextoOpcional(valor) {
  if (esVacioOBasura(valor)) return null

  return String(valor).trim()
}

export function extraerPorcentajePrincipal(texto) {
  const match = String(texto || '').match(/(\d+[.,]\d+|\d+)\s*%/)

  if (!match) return null

  return `${match[1].replace(',', '.')}%`
}

function menciona(texto, patrones) {
  const fuente = String(texto || '').toLowerCase()

  return patrones.some(patron => fuente.includes(patron.toLowerCase()))
}

function elegirPrimero(...valores) {
  for (const valor of valores) {
    if (typeof valor === 'boolean') return valor
    if (!esVacioOBasura(valor)) return valor
  }

  return null
}

export function fusionarExtraccionesBelo(extracciones) {
  const items = (extracciones || []).filter(Boolean)
  const porFuente = Object.fromEntries(
    items.map(item => [item.fuente, item.datos]),
  )

  const tarjeta = porFuente.tarjeta || {}
  const cuentaUsd = porFuente.cuentaUsd || {}
  const lux = porFuente.lux || {}

  const textos = textoDe(
    ...items.map(item => item.datos),
    ...items.map(item => item.datos?.detalles),
  )

  const costoRecibirPagos =
    extraerPorcentajePrincipal(
      elegirPrimero(
        cuentaUsd.costoRecibirPagos,
        cuentaUsd.detalles?.costoRecibirPagos,
        textos,
      ),
    ) || normalizarTextoOpcional(cuentaUsd.costoRecibirPagos)

  const detallesCostoRecibir =
    normalizarTextoOpcional(cuentaUsd.detalles?.costoRecibirPagos) ||
    (menciona(textos, ['wire', 'ach', 'apertura'])
      ? normalizarTextoOpcional(
          [
            cuentaUsd.detalles?.costoRecibirPagos,
            cuentaUsd.detalles?.costoMantenimientoTarjeta,
            cuentaUsd.detalles?.cuentaPropia,
          ]
            .filter(valor => !esVacioOBasura(valor))
            .join('. '),
        )
      : null)

  const tarjetaUsa =
    lux.tarjetaUsa === true ||
    tarjeta.tarjetaUsa === true ||
    menciona(textos, [
      'emitida en el exterior',
      'emitida en exterior',
      'visa global',
      'belo lux',
      'tarjeta global',
    ])

  const moneda = menciona(textos, [
    'usdc',
    'usdt',
    'dólares digitales',
    'dolares digitales',
  ])
    ? 'CRIPTO'
    : elegirPrimero(cuentaUsd.moneda, tarjeta.moneda, lux.moneda)

  const costoMantenimientoTarjeta =
    normalizarTextoOpcional(
      elegirPrimero(
        lux.costoMantenimientoTarjeta,
        tarjeta.costoMantenimientoTarjeta,
      ),
    ) ||
    (menciona(textos, [
      'sin costo de mantenimiento',
      'sin cuota de mantenimiento',
      'no tiene costo mensual',
      'no tiene costo de mantenimiento',
    ])
      ? '0 USD'
      : null)

  const costoTarjetaCrudo =
    normalizarTextoOpcional(
      elegirPrimero(lux.costoTarjeta, tarjeta.costoTarjeta),
    ) ||
    (menciona(textos, [
      'sin costo de emisión',
      'sin cargos ocultos',
      'pedila gratis',
      'solicitud y activación',
    ])
      ? '0%'
      : null)

  // Si Firecrawl devuelve "0 USD" como costo de uso, alinear al formato de la tabla.
  const costoTarjeta =
    costoTarjetaCrudo && /^0(\s*usd)?$/i.test(costoTarjetaCrudo)
      ? '0%'
      : costoTarjetaCrudo

  const detalles = {
    cuentaPropia: elegirPrimero(
      cuentaUsd.detalles?.cuentaPropia,
      tarjeta.detalles?.cuentaPropia,
      lux.detalles?.cuentaPropia,
    ),
    moneda: elegirPrimero(
      cuentaUsd.detalles?.moneda,
      tarjeta.detalles?.moneda,
      lux.detalles?.moneda,
    ),
    inversiones:
      elegirPrimero(
        ...[tarjeta, cuentaUsd, lux].map(fuente => {
          const valor = fuente.detalles?.inversiones
          if (
            esVacioOBasura(valor) ||
            menciona(valor, ['no se menciona', 'no permite', 'no menciona'])
          ) {
            return null
          }
          return valor
        }),
      ) || 'Rendimientos / yield disponibles en la app',
    tarjetaUsa: elegirPrimero(
      lux.detalles?.tarjetaUsa,
      tarjeta.detalles?.tarjetaUsa,
      'Tarjeta belo LUX (Visa Global) emitida en el exterior; también Mastercard local Argentina',
    ),
    costoRecibirPagos:
      detallesCostoRecibir ||
      (costoRecibirPagos
        ? 'ACH y Wire: 0.5% (mín. 0.5 USD ACH / 20 USD Wire). Apertura cuenta USD: 3 USD/año'
        : null),
    costoMantenimientoTarjeta: elegirPrimero(
      lux.detalles?.costoMantenimientoTarjeta,
      tarjeta.detalles?.costoMantenimientoTarjeta,
    ),
    costoTarjeta: elegirPrimero(
      lux.detalles?.costoTarjeta,
      tarjeta.detalles?.costoTarjeta,
    ),
    retiroArs: elegirPrimero(
      ...[tarjeta, lux, cuentaUsd].map(fuente => {
        const valor = fuente.detalles?.retiroArs
        if (
          esVacioOBasura(valor) ||
          menciona(valor, ['no se especifica', 'no hay dato', 'null'])
        ) {
          return null
        }
        return valor
      }),
      'Transferencia a CBU/CVU con conversión al tipo de cambio del momento; no confundir con extracción ATM',
    ),
  }

  return {
    compania: 'Belo',
    cuentaPropia:
      cuentaUsd.cuentaPropia === true ||
      tarjeta.cuentaPropia === true ||
      menciona(textos, ['cuenta en dólares', 'ach', 'wire']),
    moneda: moneda === 'FIAT' || moneda === 'CRIPTO' ? moneda : 'CRIPTO',
    // Las landings de tarjeta/cuenta no listan yield; belo ofrece rendimientos en la app.
    inversiones: true,
    tarjetaUsa,
    costoRecibirPagos,
    costoMantenimientoTarjeta: costoMantenimientoTarjeta || '0 USD',
    costoTarjeta: costoTarjeta || '0%',
    retiroArs:
      normalizarCostoRetiroArs(
        elegirPrimero(tarjeta.retiroArs, lux.retiroArs, cuentaUsd.retiroArs),
      ) || '0',
    detalles,
  }
}

export function normalizarCostoRetiroArs(valor) {
  const texto = normalizarTextoOpcional(valor)

  if (!texto) return null

  if (/^0(\s*(usd|usdt|%))?$/i.test(texto)) {
    return '0'
  }

  return texto
}

export function mapearBeloDesdeExtracciones(extracciones) {
  return normalizarRemesa(fusionarExtraccionesBelo(extracciones))
}

async function scrapearFuenteBelo(log, fuente) {
  logMensaje(log, 'Firecrawl: belo remesas', {
    fuente: fuente.key,
    url: fuente.url,
  })

  const datos = await scrapeWithFirecrawl(log, {
    url: fuente.url,
    prompt,
    schema,
    required: ['compania'],
  })

  return {
    fuente: fuente.key,
    url: fuente.url,
    datos,
  }
}

export async function extraerBeloRemesas(log) {
  const resultados = await Promise.allSettled(
    BELO_REMESAS_FUENTES.map(fuente => scrapearFuenteBelo(log, fuente)),
  )

  const extracciones = []

  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') {
      extracciones.push(resultado.value)
      continue
    }

    logMensaje(log, 'extraerBeloRemesas: falló una fuente', {
      errorMessage: resultado.reason?.message,
    })
  }

  if (extracciones.length === 0) {
    throw new Error('Firecrawl Belo remesas: fallaron todas las fuentes')
  }

  const remesa = mapearBeloDesdeExtracciones(extracciones)

  logMensaje(log, 'extraerBeloRemesas: Belo extraído', {
    fuentes: extracciones.map(item => item.fuente),
    costoRecibirPagos: remesa.costoRecibirPagos,
    tarjetaUsa: remesa.tarjetaUsa,
    moneda: remesa.moneda,
  })

  return remesa
}
