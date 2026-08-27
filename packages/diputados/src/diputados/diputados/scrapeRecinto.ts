import axios from 'axios'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { shouldWriteJsonFiles } from '@argentinadatos/core/src/utils/database-mode.ts'
import { USER_AGENT } from '../../constants.ts'
import type { Diputado } from './crawlDiputados.ts'
import { matchNominaToDiputadoId } from './scrapeNominaFotos.ts'

export const RECINTO_WEB_URL = 'https://parlamentaria.hcdn.gob.ar/recintoweb'

/** Asiento físico en el hemiciclo oficial (0 = podio / banca 0). */
export interface RecintoAsiento {
  banca: number
  idAutoridad: string
  cuil: string
  apellido: string
  nombre: string
  distrito: string
  bloque: string | null
  bloqueColor: string | null
  interbloque: string | null
  interbloqueColor: string | null
  mandato: string | null
  mandatoFin: string | null
  estado: string | null
  /** Id HCDN del catálogo (`HCDN…`) cuando hay match. */
  diputadoId: string | null
}

export interface RecintoPayload {
  fuente: string
  scrapedAt: string
  asientos: RecintoAsiento[]
  /** Bancas del SVG sin ocupante (p. ej. 223). */
  vacantes: number[]
}

type RecintoRaw = {
  ID_AUTORIDAD?: string
  CUIL?: string
  APELLIDO_ALIAS?: string
  NOMBRE_ALIAS?: string
  BANCA?: string | number
  ID_BANCA?: string | number
  DISTRITO?: string
  BLOQUE_NOMBRE?: string | null
  BLOQUE_COLOR?: string | null
  INTERBLOQUE_NOMBRE?: string | null
  INTERBLOQUE_COLOR?: string | null
  MANDATO?: string | null
  MANDATO_FIN?: string | null
  ESTADO?: string | null
}

function toInt(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Extrae el array `const bancas = [...]` embebido en
 * https://parlamentaria.hcdn.gob.ar/recintoweb (iframe de hcdn recinto.html).
 */
export function parseRecintoHtml(html: string): RecintoRaw[] {
  const match = html.match(/const\s+bancas\s*=\s*(\[[\s\S]*?\]);/)
  if (!match?.[1]) {
    throw new Error('recintoweb: no se encontró const bancas = [...]')
  }
  const parsed = JSON.parse(match[1]) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('recintoweb: bancas no es un array')
  }
  return parsed as RecintoRaw[]
}

export function normalizeRecintoRows(raw: RecintoRaw[]): Omit<RecintoAsiento, 'diputadoId'>[] {
  const out: Omit<RecintoAsiento, 'diputadoId'>[] = []
  for (const row of raw) {
    const banca = toInt(row.BANCA ?? row.ID_BANCA)
    const apellido = String(row.APELLIDO_ALIAS || '').trim()
    const nombre = String(row.NOMBRE_ALIAS || '').trim()
    if (banca === null || (!apellido && !nombre)) continue
    out.push({
      banca,
      idAutoridad: String(row.ID_AUTORIDAD || '').trim(),
      cuil: String(row.CUIL || '').trim(),
      apellido,
      nombre,
      distrito: String(row.DISTRITO || '').trim(),
      bloque: row.BLOQUE_NOMBRE ? String(row.BLOQUE_NOMBRE).trim() : null,
      bloqueColor: row.BLOQUE_COLOR ? String(row.BLOQUE_COLOR).trim() : null,
      interbloque: row.INTERBLOQUE_NOMBRE ? String(row.INTERBLOQUE_NOMBRE).trim() : null,
      interbloqueColor: row.INTERBLOQUE_COLOR ? String(row.INTERBLOQUE_COLOR).trim() : null,
      mandato: row.MANDATO ? String(row.MANDATO).trim() : null,
      mandatoFin: row.MANDATO_FIN ? String(row.MANDATO_FIN).trim() : null,
      estado: row.ESTADO ? String(row.ESTADO).trim() : null,
    })
  }
  return out
}

function vacantesFromAsientos(asientos: { banca: number }[], maxBanca = 256): number[] {
  const occupied = new Set(asientos.map(a => a.banca))
  const vacantes: number[] = []
  for (let i = 0; i <= maxBanca; i++) {
    if (!occupied.has(i)) vacantes.push(i)
  }
  return vacantes
}

type DiputadoMatch = {
  id: string
  nombre: string
  apellido: string
  provincia: string
  periodoMandato?: { inicio: string | null, fin: string | null }
}

/**
 * Resuelve id HCDN. Ante dos filas en la misma banca, preferimos la que tiene bloque
 * (el JS oficial hace `butacas[BANCA] = diputado` y gana el último del array).
 */
export function matchRecintoToDiputadoId(
  row: Omit<RecintoAsiento, 'diputadoId'>,
  diputados: DiputadoMatch[],
): string | null {
  return matchNominaToDiputadoId(
    {
      nombre: `${row.apellido}, ${row.nombre}`,
      slug: null,
      provincia: row.distrito,
      fotoUrl: '',
    },
    diputados,
  )
}

export function assignDiputadoIds(
  rows: Omit<RecintoAsiento, 'diputadoId'>[],
  diputados: DiputadoMatch[],
): RecintoAsiento[] {
  return rows.map(row => ({
    ...row,
    diputadoId: matchRecintoToDiputadoId(row, diputados),
  }))
}

/** Mapa id → banca (si hay colisión en la misma banca, gana quien tiene bloque). */
export function bancaByDiputadoId(asientos: RecintoAsiento[]): Record<string, number> {
  const byBanca = new Map<number, RecintoAsiento[]>()
  for (const a of asientos) {
    if (!a.diputadoId) continue
    const list = byBanca.get(a.banca) || []
    list.push(a)
    byBanca.set(a.banca, list)
  }

  const out: Record<string, number> = {}
  for (const [banca, list] of byBanca) {
    const winner = [...list].sort((a, b) => {
      const aBloque = a.bloque ? 1 : 0
      const bBloque = b.bloque ? 1 : 0
      return bBloque - aBloque
    })[0]!
    out[winner.diputadoId!] = banca
  }
  return out
}

export function applyBancasToDiputados(
  diputados: Diputado[],
  bancaMap: Record<string, number>,
): Diputado[] {
  return diputados.map((d) => {
    const banca = bancaMap[String(d.id)]
    if (banca === undefined) {
      if ('banca' in d) {
        const { banca: _drop, ...rest } = d as Diputado & { banca?: number }
        return rest as Diputado
      }
      return d
    }
    return { ...d, banca }
  })
}

export async function fetchRecintoHtml(): Promise<string> {
  const response = await axios.get<string>(RECINTO_WEB_URL, {
    timeout: 60_000,
    responseType: 'text',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    validateStatus: status => status >= 200 && status < 300,
  })
  return typeof response.data === 'string' ? response.data : String(response.data)
}

export async function scrapeRecinto(diputados: Diputado[]): Promise<RecintoPayload> {
  const html = await fetchRecintoHtml()
  const raw = parseRecintoHtml(html)
  const normalized = normalizeRecintoRows(raw)
  const catalog: DiputadoMatch[] = diputados.map(d => ({
    id: String(d.id),
    nombre: d.nombre,
    apellido: d.apellido,
    provincia: d.provincia,
    periodoMandato: d.periodoMandato,
  }))
  const asientos = assignDiputadoIds(normalized, catalog)
  return {
    fuente: RECINTO_WEB_URL,
    scrapedAt: new Date().toISOString(),
    asientos,
    vacantes: vacantesFromAsientos(asientos),
  }
}

/**
 * Scrapea el recinto, escribe `/v1/diputados/recinto` y agrega `banca` a los
 * diputados del catálogo (todas las filas del mismo id).
 */
export async function fillBancasFromRecinto(diputados: Diputado[]): Promise<{
  payload: RecintoPayload
  matched: number
  unmatched: number
}> {
  const payload = await scrapeRecinto(diputados)
  const bancaMap = bancaByDiputadoId(payload.asientos)
  const matched = Object.keys(bancaMap).length
  const unmatched = payload.asientos.filter(a => !a.diputadoId).length

  const enriched = applyBancasToDiputados(diputados, bancaMap)
  diputados.splice(0, diputados.length, ...enriched)

  if (shouldWriteJsonFiles()) {
    writeEndpoint('diputados/recinto', payload)
    writeEndpoint('/diputados/recinto', payload)
  }

  return { payload, matched, unmatched }
}

/** Relee el endpoint ya escrito (tests / warm). */
export function readRecintoEndpoint(): RecintoPayload | null {
  const raw = readEndpoint('diputados/recinto')
  if (!raw) return null
  try {
    return JSON.parse(raw) as RecintoPayload
  }
  catch {
    return null
  }
}
