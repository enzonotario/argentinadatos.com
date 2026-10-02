import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import {
  lookupCategoria,
  roundMoney,
  type EscalaSalarial,
} from './escalaSalarial.ts'
import { scrapeEscalaSalarial } from './scrapeEscalaSalarial.ts'
import {
  scrapeBloquesPersonal,
  type BloquePersonal,
  type PersonalAgente,
} from './scrapeBloquesPersonal.ts'
import {
  scrapeSenadoresPersonal,
  type SenadorPersonal,
} from './scrapeSenadorPersonal.ts'

export const BLOQUES_ENDPOINT = '/senado/bloques'
export const GASTO_ENDPOINT = '/senado/gasto'

export interface GastoPorCategoria {
  categoria: string
  cantidad: number
  montoUnitario: number
  montoUnitarioConAdicionalFuncion: number
  subtotal: number
  subtotalConAdicionalFuncion: number
}

export interface GastoPersonalResumen {
  agentes: number
  brutoMensualEstimado: number
  brutoMensualConAdicionalFuncion: number
  sinCategoriaMatch: number
  porCategoria: GastoPorCategoria[]
  metodo: string
}

export interface PersonalAgenteConMonto extends PersonalAgente {
  brutoBase: number | null
  brutoConAdicionalFuncion: number | null
}

export interface BloqueConGasto extends BloquePersonal {
  personalDetalle: PersonalAgenteConMonto[]
  gasto: GastoPersonalResumen
}

export interface SenadorPersonalConGasto extends SenadorPersonal {
  personalDetalle: PersonalAgenteConMonto[]
  gasto: GastoPersonalResumen
}

export interface SenadorGastoResumen {
  senadorId: string
  nombre: string
  bloque: string | null
  dietaBrutoEstimado: number | null
  renunciaAlAumento: boolean | null
  personalAgentes: number
  personalBrutoEstimado: number
  personalBrutoConAdicionalFuncion: number
  totalEstimado: number
}

export interface GastoSenado {
  fuenteEscala: string
  fuenteBloques: string
  fuenteDietas: string
  scrapedAt: string
  valorModulo: number
  vigenciaEscala: string | null
  dietaSenadorBrutoEstimado: number
  notas: string[]
  totales: {
    bloquesPersonalBruto: number
    despachosPersonalBruto: number
    dietasSenadoresBruto: number
    grandTotalEstimado: number
  }
  bloques: Array<{
    id: string
    nombre: string
    integrantes: number
    gasto: GastoPersonalResumen
  }>
  senadores: SenadorGastoResumen[]
}

export function computeGastoPersonal(
  personal: PersonalAgente[],
  escala: EscalaSalarial,
): {
  detalle: PersonalAgenteConMonto[]
  gasto: GastoPersonalResumen
} {
  const byCat = new Map<string, GastoPorCategoria>()
  let sinMatch = 0
  let bruto = 0
  let brutoFunc = 0

  const detalle: PersonalAgenteConMonto[] = personal.map((agente) => {
    const cat = lookupCategoria(escala, agente.categoria)
    if (!cat) {
      sinMatch++
      return {
        ...agente,
        brutoBase: null,
        brutoConAdicionalFuncion: null,
      }
    }

    bruto = roundMoney(bruto + cat.brutoBase)
    brutoFunc = roundMoney(brutoFunc + cat.brutoConAdicionalFuncion)

    const prev = byCat.get(cat.codigo) || {
      categoria: cat.codigo,
      cantidad: 0,
      montoUnitario: cat.brutoBase,
      montoUnitarioConAdicionalFuncion: cat.brutoConAdicionalFuncion,
      subtotal: 0,
      subtotalConAdicionalFuncion: 0,
    }
    prev.cantidad += 1
    prev.subtotal = roundMoney(prev.subtotal + cat.brutoBase)
    prev.subtotalConAdicionalFuncion = roundMoney(
      prev.subtotalConAdicionalFuncion + cat.brutoConAdicionalFuncion,
    )
    byCat.set(cat.codigo, prev)

    return {
      ...agente,
      brutoBase: cat.brutoBase,
      brutoConAdicionalFuncion: cat.brutoConAdicionalFuncion,
    }
  })

  const porCategoria = [...byCat.values()].sort((a, b) =>
    a.categoria.localeCompare(b.categoria, undefined, { numeric: true }),
  )

  return {
    detalle,
    gasto: {
      agentes: personal.length,
      brutoMensualEstimado: bruto,
      brutoMensualConAdicionalFuncion: brutoFunc,
      sinCategoriaMatch: sinMatch,
      porCategoria,
      metodo: 'totalEnPesos + RC (escala salarial); adicional función 10% en A-1..A-3 opcional',
    },
  }
}

function isSenadorVigente(s: {
  periodoReal?: { fin?: string | null } | null
  bloque?: string | null
}): boolean {
  const fin = s.periodoReal?.fin
  if (!fin) {
    return true
  }
  const t = Date.parse(fin)
  if (Number.isNaN(t)) {
    return true
  }
  return t >= Date.now() - 24 * 60 * 60 * 1000
}

export function attachGastoToBloques(
  bloques: BloquePersonal[],
  escala: EscalaSalarial,
): BloqueConGasto[] {
  return bloques.map((bloque) => {
    const { detalle, gasto } = computeGastoPersonal(bloque.personal, escala)
    return {
      ...bloque,
      personalDetalle: detalle,
      gasto,
    }
  })
}

export function attachGastoToSenadorPersonal(
  rows: SenadorPersonal[],
  escala: EscalaSalarial,
): SenadorPersonalConGasto[] {
  return rows.map((row) => {
    const { detalle, gasto } = computeGastoPersonal(row.personal, escala)
    return {
      ...row,
      personalDetalle: detalle,
      gasto,
    }
  })
}

export function buildGastoSenado(input: {
  escala: EscalaSalarial
  bloques: BloqueConGasto[]
  senadoresPersonal: SenadorPersonalConGasto[]
  senadores: Array<{
    id: string
    nombre: string
    bloque?: string | null
    periodoReal?: { fin?: string | null } | null
    meta?: {
      dieta?: {
        renunciaAlAumento?: boolean
      } | null
    } | null
  }>
}): GastoSenado {
  const vigentes = input.senadores.filter(isSenadorVigente)
  // Un registro por id (histórico puede repetir)
  const byId = new Map<string, (typeof vigentes)[0]>()
  for (const s of vigentes) {
    if (!byId.has(String(s.id))) {
      byId.set(String(s.id), s)
    }
  }

  const personalById = new Map(
    input.senadoresPersonal.map(p => [String(p.senadorId), p]),
  )

  const bloquePorSenadorId = new Map<string, string>()
  for (const bloque of input.bloques) {
    for (const integrante of bloque.senadores) {
      if (integrante.id && bloque.nombre) {
        bloquePorSenadorId.set(String(integrante.id), bloque.nombre)
      }
    }
  }

  const dietaBruto = input.escala.dietaSenador.brutoEstimado
  const senadoresResumen: SenadorGastoResumen[] = [...byId.values()].map((s) => {
    const pers = personalById.get(String(s.id))
    const personalBruto = pers?.gasto.brutoMensualEstimado || 0
    const personalBrutoFunc = pers?.gasto.brutoMensualConAdicionalFuncion || 0
    const renuncia = s.meta?.dieta?.renunciaAlAumento ?? null
    // Si renunció al aumento, no inventamos el monto congelado: reportamos estimado pleno + flag
    const dieta = dietaBruto
    const bloque
      = s.bloque
        || bloquePorSenadorId.get(String(s.id))
        || null

    return {
      senadorId: String(s.id),
      nombre: s.nombre,
      bloque,
      dietaBrutoEstimado: dieta,
      renunciaAlAumento: renuncia,
      personalAgentes: pers?.gasto.agentes || 0,
      personalBrutoEstimado: personalBruto,
      personalBrutoConAdicionalFuncion: personalBrutoFunc,
      totalEstimado: roundMoney(dieta + personalBruto),
    }
  }).sort((a, b) => b.totalEstimado - a.totalEstimado)

  const bloquesPersonalBruto = roundMoney(
    input.bloques.reduce((acc, b) => acc + b.gasto.brutoMensualEstimado, 0),
  )
  const despachosPersonalBruto = roundMoney(
    senadoresResumen.reduce((acc, s) => acc + s.personalBrutoEstimado, 0),
  )
  const dietasSenadoresBruto = roundMoney(
    senadoresResumen.reduce((acc, s) => acc + (s.dietaBrutoEstimado || 0), 0),
  )

  return {
    fuenteEscala: input.escala.fuente,
    fuenteBloques: 'https://www.senado.gob.ar/senadores/listados/agrupados-por-bloques',
    fuenteDietas: input.escala.dietaSenador.fuente,
    scrapedAt: new Date().toISOString(),
    valorModulo: input.escala.valorModulo,
    vigenciaEscala: input.escala.vigencia,
    dietaSenadorBrutoEstimado: dietaBruto,
    notas: [
      ...input.escala.notas,
      'Personal de bloque y de despacho se publican por separado en el Senado; pueden solaparse o no.',
      'Dieta estimada = 4000 módulos × valor módulo. renunciaAlAumento implica que el cobro real puede ser menor.',
    ],
    totales: {
      bloquesPersonalBruto,
      despachosPersonalBruto,
      dietasSenadoresBruto,
      grandTotalEstimado: roundMoney(
        bloquesPersonalBruto + despachosPersonalBruto + dietasSenadoresBruto,
      ),
    },
    bloques: input.bloques.map(b => ({
      id: b.id,
      nombre: b.nombre,
      integrantes: b.integrantes,
      gasto: b.gasto,
    })),
    senadores: senadoresResumen,
  }
}

export function persistBloques(bloques: BloqueConGasto[]): void {
  writeEndpoint(BLOQUES_ENDPOINT, bloques)
  for (const bloque of bloques) {
    writeEndpoint(`${BLOQUES_ENDPOINT}/${bloque.id}`, bloque)
  }
}

export function persistSenadoresPersonal(
  rows: SenadorPersonalConGasto[],
): void {
  for (const row of rows) {
    writeEndpoint(`/senado/senadores/${row.senadorId}/personal`, row)
  }
}

export function persistGasto(gasto: GastoSenado): void {
  writeEndpoint(GASTO_ENDPOINT, gasto)
}

/**
 * Pipeline de gasto: escala + personal bloques + personal despachos + agregado.
 */
export async function crawlGastoSenado(options?: {
  forceEscala?: boolean
  senadorIds?: string[]
  senadores?: Array<{
    id: string
    nombre: string
    bloque?: string | null
    periodoReal?: { fin?: string | null } | null
    meta?: {
      dieta?: {
        renunciaAlAumento?: boolean
      } | null
    } | null
  }>
}): Promise<{
  escala: EscalaSalarial
  bloques: BloqueConGasto[]
  senadoresPersonal: SenadorPersonalConGasto[]
  gasto: GastoSenado
}> {
  const escala = await scrapeEscalaSalarial({ force: options?.forceEscala })
  writeEndpoint('/senado/escala-salarial', escala)

  const bloquesRaw = await scrapeBloquesPersonal()
  const bloques = attachGastoToBloques(bloquesRaw, escala)
  persistBloques(bloques)

  const senadores
    = options?.senadores
      || (JSON.parse(readEndpoint('/senado/senadores') || '[]') as any[])

  const vigentesIds = options?.senadorIds || [
    ...new Set(
      senadores
        .filter(isSenadorVigente)
        .map((s: any) => String(s.id))
        .filter(Boolean),
    ),
  ]

  const personalRaw = await scrapeSenadoresPersonal(vigentesIds)
  const senadoresPersonal = attachGastoToSenadorPersonal(personalRaw, escala)
  persistSenadoresPersonal(senadoresPersonal)

  const gasto = buildGastoSenado({
    escala,
    bloques,
    senadoresPersonal,
    senadores,
  })
  persistGasto(gasto)

  return { escala, bloques, senadoresPersonal, gasto }
}

/** Completa `senador.bloque` desde el listado agrupados-por-bloques si falta. */
export function applyBloquesFromBloquesPersonal<T extends {
  id: string
  bloque?: string | null
}>(senadores: T[], bloques: Array<{ nombre: string, senadores: Array<{ id: string }> }>): T[] {
  const bloquePorId = new Map<string, string>()
  for (const bloque of bloques) {
    for (const integrante of bloque.senadores) {
      if (integrante.id && bloque.nombre) {
        bloquePorId.set(String(integrante.id), bloque.nombre)
      }
    }
  }
  for (const s of senadores) {
    if (!s.bloque) {
      s.bloque = bloquePorId.get(String(s.id)) || null
    }
  }
  return senadores
}

export function applyPersonalMetaToSenadores<T extends {
  id: string
  periodoReal?: { fin?: string | null } | null
  meta?: {
    personal?: {
      agentes: number
      brutoMensualEstimado: number
      brutoMensualConAdicionalFuncion: number
      fuente: string
    }
    dieta?: {
      renunciaAlAumento?: boolean
      donacion?: boolean
      aportesPartidarios?: boolean
      fuente?: string
      actualizado?: string
      brutoEstimado?: number
      valorModulo?: number
    } | null
    dietaEstimada?: {
      brutoEstimado: number
      valorModulo: number
      totalModulos: number
      fuente: string
      nota: string
    }
  } | null
}>(
  senadores: T[],
  senadoresPersonal: SenadorPersonalConGasto[],
  escala: EscalaSalarial,
): T[] {
  const byId = new Map(
    senadoresPersonal.map(p => [String(p.senadorId), p]),
  )
  const dietaBruto = escala.dietaSenador.brutoEstimado

  for (const s of senadores) {
    const pers = byId.get(String(s.id))
    const meta = { ...(s.meta || {}) } as NonNullable<T['meta']>

    if (pers) {
      meta.personal = {
        agentes: pers.gasto.agentes,
        brutoMensualEstimado: pers.gasto.brutoMensualEstimado,
        brutoMensualConAdicionalFuncion: pers.gasto.brutoMensualConAdicionalFuncion,
        fuente: pers.fuente,
      }
    }

    if (meta.dieta) {
      meta.dieta = {
        ...meta.dieta,
        brutoEstimado: dietaBruto,
        valorModulo: escala.valorModulo,
      }
    }

    if (isSenadorVigente(s)) {
      meta.dietaEstimada = {
        brutoEstimado: dietaBruto,
        valorModulo: escala.valorModulo,
        totalModulos: escala.dietaSenador.totalModulos,
        fuente: escala.dietaSenador.fuente,
        nota: escala.dietaSenador.nota,
      }
    }

    s.meta = Object.keys(meta).length ? meta : s.meta
  }

  return senadores
}
