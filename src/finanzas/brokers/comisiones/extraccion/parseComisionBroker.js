import {
  porcentajeADecimal,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

/**
 * Catálogo estable de productos comparables (slugs).
 * Una fila API = un arancel comparable; el cliente puede groupBy producto o entidad.
 */
export const PRODUCTOS_BROKER = Object.freeze([
  'acciones',
  'cedears',
  'bonos',
  'obligaciones_negociables',
  'letras',
  'cauciones',
  'opciones',
  'futuros',
  'fci',
  'cheques',
  'licitaciones',
  'alquiler_titulos',
])

const PRODUCTOS_SET = new Set(PRODUCTOS_BROKER)

/**
 * Normaliza un label de tarifario al slug del catálogo.
 * @param {string|null|undefined} texto
 * @returns {string|null}
 */
export function normalizarProducto(texto) {
  if (texto === null || texto === undefined) return null

  const t = String(texto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  if (!t) return null

  if (/caucion/.test(t)) return 'cauciones'
  if (
    /alquiler/.test(t) ||
    (/prestamo/.test(t) && /titulo|valor/.test(t)) ||
    /pases?\s+colocador/.test(t)
  ) {
    return 'alquiler_titulos'
  }
  if (
    /cheque/.test(t) ||
    /pagare/.test(t) ||
    /\bfce\b/.test(t) ||
    /factura de credito/.test(t)
  ) {
    return 'cheques'
  }
  if (
    /licitacion/.test(t) ||
    /canje/.test(t) ||
    /suscripcion(es)? primaria/.test(t)
  ) {
    return 'licitaciones'
  }
  if (/futuro/.test(t)) return 'futuros'
  if (/opcion|ejercicio de opcion/.test(t)) return 'opciones'
  if (/\bfci\b|fondos? comunes?/.test(t)) return 'fci'
  if (/cedear/.test(t)) return 'cedears'
  if (
    /\bon\b|obligacion(es)? negociable/.test(t) ||
    /tit\.?\s*privados|titulos privados|deuda \(privados\)|fid\.?\s*financier|vcp/.test(
      t,
    )
  ) {
    return 'obligaciones_negociables'
  }
  if (/letra/.test(t)) return 'letras'
  if (
    /bono|titulos publicos|titulo publico|deuda \(publicos\)|renta fija publica/.test(
      t,
    )
  ) {
    return 'bonos'
  }
  if (/accion|etf/.test(t)) return 'acciones'

  if (PRODUCTOS_SET.has(t)) return t
  return null
}

/**
 * Si el label junta varios productos del catálogo, devuelve todos (orden estable).
 * Ej: "acciones y Cedears" → ['acciones','cedears'].
 * @param {string|null|undefined} texto
 * @returns {string[]}
 */
export function productosDesdeConcepto(texto) {
  if (texto === null || texto === undefined) return []

  const t = String(texto)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  /** @type {string[]} */
  const hallados = []
  const push = (slug) => {
    if (PRODUCTOS_SET.has(slug) && !hallados.includes(slug)) hallados.push(slug)
  }

  if (/caucion/.test(t)) return ['cauciones']
  if (/alquiler/.test(t) || (/prestamo/.test(t) && /titulo|valor/.test(t))) {
    return ['alquiler_titulos']
  }
  if (/cheque|pagare|\bfce\b|factura de credito/.test(t)) return ['cheques']
  if (/licitacion|canje|suscripcion(es)? primaria/.test(t)) {
    return ['licitaciones']
  }
  // "Opciones (Acciones, Cedears, ...)" → solo opciones (el paréntesis es el subyacente).
  // No confundir con notas al pie tipo "Opciones (1)(2)".
  if (
    /compra\s*\/?\s*venta de opciones/.test(t) ||
    /opciones?\s*\(\s*(acciones?|cedears?|ons?|futuros?|indices?)/.test(t)
  ) {
    return ['opciones']
  }
  if (/futuro/.test(t) && !/accion|cedear|bono|opcion/.test(t)) {
    return ['futuros']
  }
  if (/\bfci\b|fondos? comunes?/.test(t)) return ['fci']

  // Labels que juntan varios instrumentos → una fila por producto comparable.
  if (/cedear/.test(t)) push('cedears')
  if (
    /\bons?\b|obligacion(es)? negociable|tit\.?\s*privados|titulos privados|deuda \(privados\)|fid\.?\s*financier|\bvcp\b/.test(
      t,
    )
  ) {
    push('obligaciones_negociables')
  }
  if (/letra/.test(t)) push('letras')
  if (/bono|titulos publicos|titulo publico|deuda \(publicos\)/.test(t)) {
    push('bonos')
  }
  if (/accion|etf/.test(t)) push('acciones')
  if (/opcion|ejercicio de opcion/.test(t)) push('opciones')
  if (/futuro/.test(t)) push('futuros')

  if (hallados.length) return hallados

  const unico = normalizarProducto(texto)
  return unico ? [unico] : []
}

/**
 * Parsea textos de comisión tipo "0,15%", "Hasta 0.50%", "2% + IVA anual", "2,0% TNA".
 * @param {string|null|undefined} texto
 * @param {number} [precision=6]
 * @returns {{
 *   tasa: number|null,
 *   tasaEsTope: boolean,
 *   ivaAdicional: boolean,
 *   incluyeIva: boolean,
 *   tasaBaseHint: 'mensual'|'anual'|'tna'|null,
 * }}
 */
export function parseTasaComisionTexto(texto, precision = 6) {
  if (texto === null || texto === undefined) {
    return {
      tasa: null,
      tasaEsTope: false,
      ivaAdicional: false,
      incluyeIva: false,
      tasaBaseHint: null,
    }
  }

  const raw = String(texto).replace(/\u00a0/g, ' ').trim()

  if (
    !raw ||
    raw === '-' ||
    /^n\/?a$/i.test(raw) ||
    /^nd$/i.test(raw) ||
    /^consultar$/i.test(raw) ||
    /^sin\s+(cargo|costo)$/i.test(raw)
  ) {
    return {
      tasa: null,
      tasaEsTope: false,
      ivaAdicional: false,
      incluyeIva: false,
      tasaBaseHint: null,
    }
  }

  const tasaEsTope = /\bhasta\b/i.test(raw) || /\bm[aá]xim/i.test(raw)
  const ivaAdicional =
    /\+?\s*IVA\b/i.test(raw) || /no incluyen IVA/i.test(raw)
  const incluyeIva = /\bcon IVA\b/i.test(raw) || /\bincluye IVA\b/i.test(raw)

  let tasaBaseHint = null
  if (/\bTNA\b/i.test(raw) || /\bTasa Nominal Anual\b/i.test(raw)) {
    tasaBaseHint = 'tna'
  } else if (/\bmensual\b/i.test(raw)) {
    tasaBaseHint = 'mensual'
  } else if (/\banual\b/i.test(raw)) {
    tasaBaseHint = 'anual'
  }

  const pctMatch = raw.match(/([\d]+(?:[.,]\d+)?)\s*%/)
  let tasa = null

  if (pctMatch) {
    const limpio = pctMatch[1].includes(',')
      ? pctMatch[1].replace(/\./g, '').replace(',', '.')
      : pctMatch[1]
    tasa = porcentajeADecimal(Number.parseFloat(limpio), precision)
  }

  return {
    tasa,
    tasaEsTope,
    ivaAdicional,
    incluyeIva,
    tasaBaseHint,
  }
}

/**
 * @param {string|null|undefined} texto
 * @returns {number|null}
 */
export function parseComisionMinimaTexto(texto) {
  if (!texto) return null
  const m = String(texto).match(/\$\s*([\d.]+)/)
  if (!m) return null
  const n = Number.parseInt(String(m[1]).replace(/\./g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {number|null|undefined} tasa
 * @param {'mensual'|'anual'|'tna'|null|undefined} tasaBase
 * @param {number} [precision=6]
 * @returns {number|null}
 */
export function calcularTasaAnualEquivalente(tasa, tasaBase, precision = 6) {
  if (tasa === null || tasa === undefined || Number.isNaN(Number(tasa))) {
    return null
  }

  if (tasaBase === 'mensual') {
    return redondearTasa(Number(tasa) * 12, precision)
  }

  if (tasaBase === 'anual' || tasaBase === 'tna') {
    return redondearTasa(Number(tasa), precision)
  }

  return null
}

/**
 * Factory de fila comparable de comisión de broker.
 * `producto` debe pertenecer a PRODUCTOS_BROKER (default: cauciones).
 * @param {object} parcial
 * @returns {object}
 */
export function crearComisionBroker(parcial) {
  const tasaBase = parcial.tasaBase ?? null
  const tasa = parcial.tasa ?? null
  const tasaAnualEquivalente =
    parcial.tasaAnualEquivalente !== undefined
      ? parcial.tasaAnualEquivalente
      : calcularTasaAnualEquivalente(tasa, tasaBase)

  const productoRaw = parcial.producto ?? 'cauciones'
  const producto = PRODUCTOS_SET.has(productoRaw)
    ? productoRaw
    : normalizarProducto(productoRaw) ?? 'cauciones'

  return {
    entidad: parcial.entidad,
    nombreComercial: parcial.nombreComercial,
    producto,
    operacion: parcial.operacion,
    moneda: parcial.moneda ?? 'ARS',
    canal: parcial.canal ?? 'web',
    plan: parcial.plan ?? null,
    tasa,
    tasaBase,
    tasaAnualEquivalente,
    tasaEsTope: Boolean(parcial.tasaEsTope),
    incluyeIva: Boolean(parcial.incluyeIva),
    ivaAdicional: Boolean(parcial.ivaAdicional),
    prorrateoDias:
      parcial.prorrateoDias === undefined ? null : parcial.prorrateoDias,
    comisionMinima:
      parcial.comisionMinima === undefined ? null : parcial.comisionMinima,
    derechoMercado:
      parcial.derechoMercado === undefined ? null : parcial.derechoMercado,
    enlace: parcial.enlace ?? null,
    metadata:
      parcial.metadata && typeof parcial.metadata === 'object'
        ? parcial.metadata
        : {},
  }
}
