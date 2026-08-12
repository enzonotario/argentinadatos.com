import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logMensaje } from '@/log.js'
import {
  extraerPorcentajePrincipal,
  normalizarCostoRetiroArs,
} from '@/finanzas/remesas/extraccion/extraerBeloRemesas.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

export const RIPIO_REMESAS_FUENTES = [
  {
    key: 'tarjeta',
    url: 'https://www.ripio.com/es/productos/cripto-card',
  },
  {
    key: 'cuentaExterior',
    url: 'https://launchpad.ripio.com/novedades/ya-podes-tener-tu-cuenta-en-el-exterior',
  },
  {
    key: 'ach',
    url: 'https://launchpad.ripio.com/blog/transferencias-ach-que-son-y-cuanto-demoran',
  },
]

const schema = {
  compania: {
    type: 'string',
    description: 'Nombre de la compañía (Ripio)',
  },
  cuentaPropia: {
    type: 'boolean',
    description:
      'Tiene cuenta propia en dólares/exterior (ACH/Wire) u otra cuenta bancaria propia',
  },
  moneda: {
    type: 'string',
    description:
      'FIAT si acredita dólares fiat; CRIPTO si acredita UXD/USDC/USDT u otra cripto',
  },
  inversiones: {
    type: 'boolean',
    description: 'Permite inversiones o rendimientos',
  },
  tarjetaUsa: {
    type: 'boolean',
    description:
      'true SOLO si la tarjeta está emitida en EEUU/exterior; false si es Visa prepaga argentina (Digipayments) aunque sea de uso internacional',
  },
  costoRecibirPagos: {
    type: 'string',
    description: 'Comisión principal por recibir pagos/depósitos (ej. 1.5%)',
  },
  costoMantenimientoTarjeta: {
    type: 'string',
    description:
      'Costo de mantenimiento de la Ripio Card (no el de la cuenta exterior)',
  },
  costoTarjeta: {
    type: 'string',
    description: 'Costo de uso de la tarjeta (ej. 0%)',
  },
  retiroArs: {
    type: 'string',
    description: 'Costo de retiro/conversión a ARS (no ATM)',
  },
  calificacionAndroid: {
    type: 'number',
    description: 'Puntaje en Google Play si aparece',
  },
  calificacionIos: {
    type: 'number',
    description: 'Puntaje en App Store si aparece',
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

const prompt = `Extraé atributos de Ripio para una tabla comparativa de remesas/cobro del exterior en Argentina.
Campos:
- compania: "Ripio"
- cuentaPropia: true si permite cuenta en el exterior / USD (ACH/Wire)
- moneda: "CRIPTO" si acredita UXD/USDC/USDT/cripto; "FIAT" solo si acredita dólares fiat
- inversiones: true si menciona rendimientos/recompensas
- tarjetaUsa: true SOLO si la tarjeta está emitida en EEUU/exterior. La Ripio Card argentina (Digipayments / Visa prepaga local de uso internacional) es false
- costoRecibirPagos: comisión de depósito ACH/Wire (ej. "1.5%"). NO uses cashback de la card como costo de recibir pagos
- costoMantenimientoTarjeta: mantenimiento de la CARD (ej. "0 USD"); NO uses el mantenimiento anual de la cuenta exterior
- costoTarjeta: costo de uso de la card (ej. "0%")
- retiroArs: costo de transferir/convertir a ARS bancario (no ATM)
- calificacionAndroid / calificacionIos: números si aparecen en la página
- detalles: aclaraciones (fijos ACH/Wire, mantenimiento cuenta exterior, cashback, UXD, etc.)
Solo información explícita. Si falta, null (no "No", no "Free", no "null" como string).`

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
    [
      'null',
      'undefined',
      'no',
      'n/a',
      'na',
      'free',
      'none',
      '-',
      'no especificado',
      'no se especifica',
    ].includes(normalizado)
  )
}

function normalizarTextoOpcional(valor) {
  if (esVacioOBasura(valor)) return null

  return String(valor).trim()
}

function menciona(texto, patrones) {
  const fuente = String(texto || '').toLowerCase()

  return patrones.some(patron => fuente.includes(patron.toLowerCase()))
}

function elegirPrimero(...valores) {
  for (const valor of valores) {
    if (typeof valor === 'boolean') return valor
    if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) {
      return valor
    }
    if (!esVacioOBasura(valor)) return valor
  }

  return null
}

function pareceCashback(texto) {
  return menciona(texto, [
    'cashback',
    'reintegro',
    'pagando con cripto',
    'pagando con ars',
  ])
}

function costoRecibirDesdeFuente(fuente) {
  const candidatos = [
    fuente?.costoRecibirPagos,
    fuente?.detalles?.costoRecibirPagos,
  ]

  for (const candidato of candidatos) {
    if (esVacioOBasura(candidato) || pareceCashback(candidato)) continue

    const porcentaje = extraerPorcentajePrincipal(candidato)
    if (porcentaje)
      return { porcentaje, detalle: normalizarTextoOpcional(candidato) }
  }

  return null
}

function pareceFeeFijoDeposito(texto) {
  return (
    menciona(texto, ['0.50', '0,50', '20 usd', '+ 0.5']) &&
    !menciona(texto, ['cbu', 'cvu', 'retiro', 'ars', 'pesos'])
  )
}

export function fusionarExtraccionesRipio(extracciones) {
  const items = (extracciones || []).filter(Boolean)
  const porFuente = Object.fromEntries(
    items.map(item => [item.fuente, item.datos]),
  )

  const tarjeta = porFuente.tarjeta || {}
  const cuentaExterior = porFuente.cuentaExterior || {}
  const ach = porFuente.ach || {}

  const textos = textoDe(
    ...items.map(item => item.datos),
    ...items.map(item => item.datos?.detalles),
  )

  const fee =
    costoRecibirDesdeFuente(cuentaExterior) ||
    costoRecibirDesdeFuente(ach) ||
    costoRecibirDesdeFuente(tarjeta)

  const costoRecibirPagos = fee?.porcentaje || null

  const detallesCostoRecibir =
    fee?.detalle ||
    (costoRecibirPagos
      ? '1.5% + 0.50 USD (ACH) o + 20 USD (Wire). Mantenimiento cuenta exterior: 5 USD/año (persona física)'
      : null)

  const tarjetaUsa =
    cuentaExterior.tarjetaUsa === false ||
    ach.tarjetaUsa === false ||
    menciona(textos, ['digipayments', 'no es tarjeta emitida en eeuu'])
      ? false
      : menciona(textos, [
            'emitida en eeuu',
            'emitida en el exterior',
            'usa card',
          ])
        ? true
        : false

  const moneda = menciona(textos, [
    'uxd',
    'usdc',
    'usdt',
    'criptodólar',
    'criptodolar',
  ])
    ? 'CRIPTO'
    : elegirPrimero(cuentaExterior.moneda, ach.moneda, tarjeta.moneda)

  const costoMantenimientoTarjeta =
    normalizarTextoOpcional(
      elegirPrimero(
        tarjeta.costoMantenimientoTarjeta,
        tarjeta.detalles?.costoMantenimientoTarjeta,
      ),
    ) ||
    (menciona(textos, [
      'sin costo de mantenimiento',
      'tarjeta gratis',
      'sin costos',
    ])
      ? '0 USD'
      : null)

  const costoMantenimientoNormalizado =
    costoMantenimientoTarjeta &&
    (/^0(\s*(usd|%))?$/i.test(costoMantenimientoTarjeta) ||
      menciona(costoMantenimientoTarjeta, ['sin costo', 'gratis']))
      ? '0 USD'
      : // Evitar confundir mantenimiento de cuenta exterior (5 USD/año) con la card
        menciona(costoMantenimientoTarjeta || '', ['cuenta', 'anual', '5 usd'])
        ? '0 USD'
        : costoMantenimientoTarjeta

  const costoTarjetaCrudo =
    normalizarTextoOpcional(elegirPrimero(tarjeta.costoTarjeta)) ||
    (menciona(textos, [
      'tarjeta gratis',
      'sin costo de mantenimiento',
      'sin costos',
    ])
      ? '0%'
      : null)

  const costoTarjeta =
    costoTarjetaCrudo &&
    (/^0(\s*usd)?$/i.test(costoTarjetaCrudo) ||
      menciona(costoTarjetaCrudo, ['sin costo', 'mantenimiento']))
      ? '0%'
      : costoTarjetaCrudo

  const detalles = {
    cuentaPropia: elegirPrimero(
      cuentaExterior.detalles?.cuentaPropia,
      ach.detalles?.cuentaPropia,
      tarjeta.detalles?.cuentaPropia,
      'Cuenta en el exterior (Bridge) para recibir USD desde EE.UU. vía ACH/Wire',
    ),
    moneda: elegirPrimero(
      cuentaExterior.detalles?.moneda,
      ach.detalles?.moneda,
      tarjeta.detalles?.moneda,
      'Los depósitos se acreditan como UXD (criptodólar)',
    ),
    inversiones: elegirPrimero(
      cuentaExterior.detalles?.inversiones,
      tarjeta.detalles?.inversiones,
      'Recompensa ~2% anual en UXD; rendimientos en criptos',
    ),
    tarjetaUsa: elegirPrimero(
      cuentaExterior.detalles?.tarjetaUsa,
      'Ripio Card Visa prepaga argentina (Digipayments); uso internacional, no emitida en EEUU',
    ),
    costoRecibirPagos:
      detallesCostoRecibir && detallesCostoRecibir.length > 8
        ? detallesCostoRecibir
        : costoRecibirPagos
          ? '1.5% + 0.50 USD (ACH) o + 20 USD (Wire). Mantenimiento cuenta exterior: 5 USD/año (persona física)'
          : null,
    costoMantenimientoTarjeta: elegirPrimero(
      ...[tarjeta].map(fuente => {
        const valor = fuente.detalles?.costoMantenimientoTarjeta
        if (
          esVacioOBasura(valor) ||
          menciona(valor, ['mantenimiento de la tarjeta', '5 usd', 'anual'])
        ) {
          return null
        }
        return valor
      }),
      'Card sin mantenimiento; la cuenta exterior cobra 5 USD/año (persona física)',
    ),
    costoTarjeta: elegirPrimero(
      ...[tarjeta].map(fuente => {
        const valor = fuente.detalles?.costoTarjeta
        if (
          esVacioOBasura(valor) ||
          menciona(valor, ['costo de uso de la tarjeta'])
        ) {
          return null
        }
        return valor
      }),
      'Cashback desde 2% en cripto / 0.5% en ARS (no es fee de uso)',
    ),
    retiroArs: elegirPrimero(
      ...[tarjeta, cuentaExterior, ach].map(fuente => {
        const valor = fuente.detalles?.retiroArs
        if (
          esVacioOBasura(valor) ||
          menciona(valor, [
            'no especificado',
            'costo de transferir/convertir',
          ]) ||
          pareceFeeFijoDeposito(valor)
        ) {
          return null
        }
        return valor
      }),
      'Conversión/venta a ARS en la app; no confundir con extracción ATM',
    ),
  }

  const retiroArsCrudo = elegirPrimero(
    tarjeta.retiroArs,
    cuentaExterior.retiroArs,
    ach.retiroArs,
  )

  return {
    compania: 'Ripio',
    cuentaPropia:
      cuentaExterior.cuentaPropia === true ||
      ach.cuentaPropia === true ||
      menciona(textos, ['cuenta en el exterior', 'ach', 'wire']),
    moneda: moneda === 'FIAT' || moneda === 'CRIPTO' ? moneda : 'CRIPTO',
    // La landing de card puede no listar yield; Ripio ofrece recompensa UXD / rendimientos.
    inversiones: true,
    tarjetaUsa,
    costoRecibirPagos,
    costoMantenimientoTarjeta: costoMantenimientoNormalizado || '0 USD',
    costoTarjeta: costoTarjeta || '0%',
    retiroArs:
      normalizarCostoRetiroArs(
        retiroArsCrudo && !pareceFeeFijoDeposito(retiroArsCrudo)
          ? retiroArsCrudo
          : null,
      ) || '0',
    calificacionAndroid: elegirPrimero(
      tarjeta.calificacionAndroid,
      cuentaExterior.calificacionAndroid,
    ),
    calificacionIos: elegirPrimero(
      tarjeta.calificacionIos,
      cuentaExterior.calificacionIos,
    ),
    detalles,
  }
}

export function mapearRipioDesdeExtracciones(extracciones) {
  return normalizarRemesa(fusionarExtraccionesRipio(extracciones))
}

async function scrapearFuenteRipio(log, fuente) {
  logMensaje(log, 'Firecrawl: ripio remesas', {
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

export async function extraerRipioRemesas(log) {
  const resultados = await Promise.allSettled(
    RIPIO_REMESAS_FUENTES.map(fuente => scrapearFuenteRipio(log, fuente)),
  )

  const extracciones = []

  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') {
      extracciones.push(resultado.value)
      continue
    }

    logMensaje(log, 'extraerRipioRemesas: falló una fuente', {
      errorMessage: resultado.reason?.message,
    })
  }

  if (extracciones.length === 0) {
    throw new Error('Firecrawl Ripio remesas: fallaron todas las fuentes')
  }

  const remesa = mapearRipioDesdeExtracciones(extracciones)

  logMensaje(log, 'extraerRipioRemesas: Ripio extraído', {
    fuentes: extracciones.map(item => item.fuente),
    costoRecibirPagos: remesa.costoRecibirPagos,
    tarjetaUsa: remesa.tarjetaUsa,
    moneda: remesa.moneda,
  })

  return remesa
}
