import axios from 'axios'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { BASE_URL, USER_AGENT } from '../../constants.ts'

export const PERIODOS_DATASET_SLUG = 'periodos_p'
export const PERIODOS_DATASET_URL = `${BASE_URL}/dataset/${PERIODOS_DATASET_SLUG}`
export const PERIODOS_ENDPOINT = '/diputados/periodos'

const CKAN_PACKAGE_SHOW = `${BASE_URL}/api/3/action/package_show`

export type PeriodoTramoTipo = 'ordinario' | 'extraordinario' | 'prorroga' | 'otro'

export interface PeriodoTramo {
  id: string
  tipo: PeriodoTramoTipo
  /** YYYY-MM-DD */
  inicio: string
  /** YYYY-MM-DD */
  fin: string
  /** Fecha de inicio de sesiones del período (YYYY-MM-DD). */
  sesiones: string | null
}

export interface PeriodoParlamentario {
  /** Número de período (mismo valor que `acta.periodo`). */
  periodo: string
  /** YYYY-MM-DD — mínimo INICIO de los tramos HCDN. */
  inicio: string
  /** YYYY-MM-DD — máximo FIN de los tramos HCDN. */
  fin: string
  /** Preferimos el ordinario; si no hay, el más temprano. */
  sesiones: string | null
  tramos: PeriodoTramo[]
}

export interface PeriodosData {
  fuente: string
  actualizado: string
  periodos: PeriodoParlamentario[]
}

function toIsoDate(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

export function tipoFromPeriodoId(id: string): PeriodoTramoTipo {
  const suffix = String(id || '').trim().slice(-1).toUpperCase()
  if (suffix === 'O') return 'ordinario'
  if (suffix === 'E') return 'extraordinario'
  if (suffix === 'D') return 'prorroga'
  return 'otro'
}

export function aggregatePeriodosFromHcdnRows(
  rows: Array<Record<string, unknown>>,
): PeriodoParlamentario[] {
  const byPeriodo = new Map<string, PeriodoTramo[]>()

  for (const row of rows || []) {
    const periodo = String(row.PERIODO ?? row.periodo ?? '').trim()
    if (!periodo || !/^\d+$/.test(periodo)) continue

    const id = String(row.ID ?? row.id ?? '').trim() || `HCDN${periodo}`
    const inicio = toIsoDate(String(row.INICIO ?? row.inicio ?? ''))
    const fin = toIsoDate(String(row.FIN ?? row.fin ?? ''))
    if (!inicio || !fin) continue

    const sesiones = toIsoDate(String(row.SESIONES ?? row.sesiones ?? ''))
    const list = byPeriodo.get(periodo) || []
    list.push({
      id,
      tipo: tipoFromPeriodoId(id),
      inicio,
      fin,
      sesiones,
    })
    byPeriodo.set(periodo, list)
  }

  const out: PeriodoParlamentario[] = []
  for (const [periodo, tramos] of byPeriodo) {
    tramos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id))
    const inicio = tramos.reduce((acc, t) => (t.inicio < acc ? t.inicio : acc), tramos[0]!.inicio)
    const fin = tramos.reduce((acc, t) => (t.fin > acc ? t.fin : acc), tramos[0]!.fin)
    const ordinario = tramos.find(t => t.tipo === 'ordinario')
    const sesiones = ordinario?.sesiones || tramos[0]?.sesiones || null
    out.push({ periodo, inicio, fin, sesiones, tramos })
  }

  out.sort((a, b) => Number(b.periodo) - Number(a.periodo))
  return out
}

async function resolveJsonResourceUrl(): Promise<string> {
  const response = await axios.get(CKAN_PACKAGE_SHOW, {
    params: { id: PERIODOS_DATASET_SLUG },
    timeout: 30_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  const resources = response.data?.result?.resources
  if (!Array.isArray(resources)) {
    throw new Error('Periodos diputados: package_show sin resources')
  }

  const json = resources.find((r: any) => {
    const format = String(r?.format || '').toUpperCase()
    const url = String(r?.url || '').toLowerCase()
    return format === 'JSON' || url.endsWith('.json')
  })
  if (!json?.url) {
    throw new Error('Periodos diputados: no hay recurso JSON en CKAN')
  }

  return String(json.url)
    .replace(/^http:\/\//i, 'https://')
    .replace(':443/', '/')
}

export async function crawlPeriodos(): Promise<PeriodosData> {
  const url = await resolveJsonResourceUrl()
  const response = await axios.get(url, {
    timeout: 60_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  const rows = Array.isArray(response.data) ? response.data : []
  const periodos = aggregatePeriodosFromHcdnRows(rows)
  if (!periodos.length) {
    throw new Error('Periodos diputados: JSON vacío o sin filas válidas')
  }

  const data: PeriodosData = {
    fuente: PERIODOS_DATASET_URL,
    actualizado: new Date().toISOString(),
    periodos,
  }

  writeEndpoint(PERIODOS_ENDPOINT, data)
  writeEndpoint(`${PERIODOS_ENDPOINT}/lista`, periodos)

  console.log(`Periodos diputados: ${periodos.length} períodos (${rows.length} tramos HCDN)`)
  return data
}

export function readPeriodos(): PeriodosData | null {
  try {
    const raw = JSON.parse(readEndpoint(PERIODOS_ENDPOINT) || 'null')
    if (!raw || !Array.isArray(raw.periodos)) return null
    return raw as PeriodosData
  }
  catch {
    return null
  }
}
