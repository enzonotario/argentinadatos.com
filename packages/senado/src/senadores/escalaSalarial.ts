/**
 * Escala salarial planta permanente/temporaria del Senado.
 *
 * Los conteos de módulos por categoría son estables entre escalas publicadas.
 * Solo cambia el valor del módulo (y por eso los montos en pesos).
 *
 * Fuente oficial del archivo: /prensa/adjunto/descargarArchivo/tipo/EscalaSalarial
 * (hoy JPEG; antes PDF estático desactualizado).
 */

export const ESCALA_SALARIAL_URL
  = 'https://www.senado.gob.ar/prensa/adjunto/descargarArchivo/tipo/EscalaSalarial'

export const ESCALA_SALARIAL_ENDPOINT = '/senado/escala-salarial'

/** RC 2 y 6/22: adicional fijo en módulos para todas las categorías. */
export const RC_MODULOS = 85.141

/** Adicional por función: 10% sobre Total en Pesos, categorías 1–3. */
export const ADICIONAL_FUNCION_PCT = 0.1

/** Presentismo: 100 módulos (no se aplica por persona: falta dato). */
export const PRESENTISMO_MODULOS = 100

/** Antigüedad: 6.60 módulos por año (no se aplica por persona: falta dato). */
export const ANTIGUEDAD_MODULOS_POR_ANIO = 6.6

/**
 * Dieta senador (DR 8/24, página /dietas):
 * 2500 dieta + 1000 gastos de representación + 500 desarraigo.
 */
export const DIETA_MODULOS = 2500
export const DIETA_GASTOS_REPRESENTACION_MODULOS = 1000
export const DIETA_DESARRAIGO_MODULOS = 500
export const DIETA_TOTAL_MODULOS
  = DIETA_MODULOS + DIETA_GASTOS_REPRESENTACION_MODULOS + DIETA_DESARRAIGO_MODULOS

export const DIETAS_PAGE_URL = 'https://www.senado.gob.ar/dietas'

/** Dedicación funcional + sueldo básico (módulos) por categoría 1–14. */
export const CATEGORIA_MODULOS: ReadonlyArray<{
  categoria: number
  dedicacionFuncional: number
  sueldoBasico: number
  capacitacion: number
}> = [
  { categoria: 1, dedicacionFuncional: 591.5, sueldoBasico: 253.5, capacitacion: 39 },
  { categoria: 2, dedicacionFuncional: 501.2, sueldoBasico: 214.8, capacitacion: 40 },
  { categoria: 3, dedicacionFuncional: 424.2, sueldoBasico: 181.8, capacitacion: 41 },
  { categoria: 4, dedicacionFuncional: 370.3, sueldoBasico: 158.7, capacitacion: 42 },
  { categoria: 5, dedicacionFuncional: 322.7, sueldoBasico: 138.3, capacitacion: 43 },
  { categoria: 6, dedicacionFuncional: 281.4, sueldoBasico: 120.6, capacitacion: 44 },
  { categoria: 7, dedicacionFuncional: 245, sueldoBasico: 105, capacitacion: 45 },
  { categoria: 8, dedicacionFuncional: 214.2, sueldoBasico: 91.8, capacitacion: 46 },
  { categoria: 9, dedicacionFuncional: 177.8, sueldoBasico: 76.2, capacitacion: 47 },
  { categoria: 10, dedicacionFuncional: 156.8, sueldoBasico: 67.2, capacitacion: 48 },
  { categoria: 11, dedicacionFuncional: 139.3, sueldoBasico: 59.7, capacitacion: 49 },
  { categoria: 12, dedicacionFuncional: 123.2, sueldoBasico: 52.8, capacitacion: 50 },
  { categoria: 13, dedicacionFuncional: 108.5, sueldoBasico: 46.5, capacitacion: 51 },
  { categoria: 14, dedicacionFuncional: 96.6, sueldoBasico: 41.4, capacitacion: 52 },
]

export interface EscalaCategoria {
  categoria: number
  codigo: string
  dedicacionFuncionalModulos: number
  sueldoBasicoModulos: number
  totalModulos: number
  dedicacionFuncionalPesos: number
  sueldoBasicoPesos: number
  /** Dedicación + básico (columna "Total en pesos" de la escala). */
  totalEnPesos: number
  /** RC 2 y 6/22 en pesos. */
  rc: number
  /** Monto primario: Total en Pesos + RC. */
  brutoBase: number
  /** brutoBase + 10% de totalEnPesos si categoría ≤ 3. */
  brutoConAdicionalFuncion: number
  capacitacionModulos: number
  capacitacionPesos: number
}

export interface EscalaConcepto {
  codigo: string
  nombre: string
  modulos: number | null
  pesos: number | null
  nota?: string
}

export interface EscalaSalarial {
  fuente: string
  vigencia: string | null
  valorModulo: number
  scrapedAt: string
  categorias: EscalaCategoria[]
  conceptos: EscalaConcepto[]
  dietaSenador: {
    fuente: string
    dietaModulos: number
    gastosRepresentacionModulos: number
    desarraigoModulos: number
    totalModulos: number
    brutoEstimado: number
    nota: string
  }
  notas: string[]
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function parseNumeroAr(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw
  }
  if (typeof raw !== 'string') {
    return null
  }
  const cleaned = raw
    .trim()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!cleaned) {
    return null
  }
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Normaliza "A-1", "A1", "a-01", "1" → "A-1". */
export function normalizeCategoriaCodigo(raw: string): string | null {
  const s = String(raw || '').trim().toUpperCase()
  const m = s.match(/^A?-?0*([1-9]|1[0-4])$/)
  if (!m) {
    return null
  }
  return `A-${Number(m[1])}`
}

export function categoriaNumeroFromCodigo(codigo: string): number | null {
  const normalized = normalizeCategoriaCodigo(codigo)
  if (!normalized) {
    return null
  }
  return Number(normalized.slice(2))
}

export function buildEscalaSalarial(input: {
  valorModulo: number
  vigencia?: string | null
  scrapedAt?: string
  fuente?: string
}): EscalaSalarial {
  const valorModulo = input.valorModulo
  if (!(valorModulo > 0)) {
    throw new Error(`valorModulo inválido: ${valorModulo}`)
  }

  const rc = roundMoney(RC_MODULOS * valorModulo)

  const categorias: EscalaCategoria[] = CATEGORIA_MODULOS.map((row) => {
    const totalModulos = roundMoney(row.dedicacionFuncional + row.sueldoBasico)
    const dedicacionFuncionalPesos = roundMoney(row.dedicacionFuncional * valorModulo)
    const sueldoBasicoPesos = roundMoney(row.sueldoBasico * valorModulo)
    const totalEnPesos = roundMoney(dedicacionFuncionalPesos + sueldoBasicoPesos)
    const brutoBase = roundMoney(totalEnPesos + rc)
    const adicionalFuncion = row.categoria <= 3
      ? roundMoney(totalEnPesos * ADICIONAL_FUNCION_PCT)
      : 0

    return {
      categoria: row.categoria,
      codigo: `A-${row.categoria}`,
      dedicacionFuncionalModulos: row.dedicacionFuncional,
      sueldoBasicoModulos: row.sueldoBasico,
      totalModulos,
      dedicacionFuncionalPesos,
      sueldoBasicoPesos,
      totalEnPesos,
      rc,
      brutoBase,
      brutoConAdicionalFuncion: roundMoney(brutoBase + adicionalFuncion),
      capacitacionModulos: row.capacitacion,
      capacitacionPesos: roundMoney(row.capacitacion * valorModulo),
    }
  })

  const conceptos: EscalaConcepto[] = [
    {
      codigo: 'rc',
      nombre: 'RC 2 y 6/22',
      modulos: RC_MODULOS,
      pesos: rc,
      nota: 'Adicional fijo aplicado a todas las categorías en brutoBase.',
    },
    {
      codigo: 'antiguedad',
      nombre: 'Antigüedad (por año)',
      modulos: ANTIGUEDAD_MODULOS_POR_ANIO,
      pesos: roundMoney(ANTIGUEDAD_MODULOS_POR_ANIO * valorModulo),
      nota: 'No se suma al gasto por agente: el listado no informa antigüedad.',
    },
    {
      codigo: 'presentismo',
      nombre: 'Presentismo',
      modulos: PRESENTISMO_MODULOS,
      pesos: roundMoney(PRESENTISMO_MODULOS * valorModulo),
      nota: 'No se suma al gasto por agente: el listado no informa presentismo.',
    },
    {
      codigo: 'adicional_funcion',
      nombre: 'Adicional por función (cat. 1–3)',
      modulos: null,
      pesos: null,
      nota: '10% sobre Total en Pesos. Incluido en brutoConAdicionalFuncion.',
    },
  ]

  const dietaBruto = roundMoney(DIETA_TOTAL_MODULOS * valorModulo)

  return {
    fuente: input.fuente || ESCALA_SALARIAL_URL,
    vigencia: input.vigencia ?? null,
    valorModulo,
    scrapedAt: input.scrapedAt || new Date().toISOString(),
    categorias,
    conceptos,
    dietaSenador: {
      fuente: DIETAS_PAGE_URL,
      dietaModulos: DIETA_MODULOS,
      gastosRepresentacionModulos: DIETA_GASTOS_REPRESENTACION_MODULOS,
      desarraigoModulos: DIETA_DESARRAIGO_MODULOS,
      totalModulos: DIETA_TOTAL_MODULOS,
      brutoEstimado: dietaBruto,
      nota: 'Estimado a valor de módulo vigente. Quien renunció al aumento puede cobrar menos.',
    },
    notas: [
      'brutoBase = Total en Pesos (dedicación + básico) + RC 2 y 6/22.',
      'No incluye título, antigüedad, presentismo ni otros adicionales sin dato por persona.',
      'brutoConAdicionalFuncion suma 10% de Total en Pesos en categorías A-1 a A-3.',
    ],
  }
}

export function lookupCategoria(
  escala: EscalaSalarial,
  codigoRaw: string,
): EscalaCategoria | null {
  const codigo = normalizeCategoriaCodigo(codigoRaw)
  if (!codigo) {
    return null
  }
  return escala.categorias.find(c => c.codigo === codigo) || null
}
