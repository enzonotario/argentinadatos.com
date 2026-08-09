import axios from 'axios'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { BASE_URL, USER_AGENT } from '../../constants.ts'
import {
  claveApellidoNombre,
  parseCsvText,
} from '../viajes/crawlViajes.ts'

export const MISIONES_DATASET_SLUG = 'misiones-oficiales'
export const MISIONES_DATASET_URL = `${BASE_URL}/dataset/${MISIONES_DATASET_SLUG}`
export const MISIONES_ENDPOINT = '/diputados/misiones'

const CKAN_PACKAGE_SHOW = `${BASE_URL}/api/3/action/package_show`
const DOWNLOAD_CONCURRENCY = 4

export interface MisionRecurso {
  id: string
  nombre: string
  url: string
}

/** Misión oficial al exterior (CKAN `misiones-oficiales`). */
export interface MisionOficial {
  anio: number
  mes: number | null
  mesNombre: string | null
  recursoId: string
  recursoUrl: string
  recursoNombre: string
  /** Alias de `recursoId` para links de fuente. */
  documentoId: string
  /** Alias de `recursoUrl` para links de fuente. */
  documentoUrl: string
  nombre: string
  diputadoId: string | null
  destino: string
  fechaInicio: string | null
  fechaFin: string | null
  fechaTexto: string | null
  /** Institución que invita. */
  institucion: string | null
  viaticos: boolean | null
  viaticosUsd: number | null
  viaticosEuro: number | null
  viaticosArs: number | null
  motivo: string | null
  bloque: string | null
}

export interface MisionesData {
  fuente: string
  actualizado: string
  recursos: MisionRecurso[]
  misiones: MisionOficial[]
}

export interface DiputadoMisiones {
  diputadoId: string
  misiones: MisionOficial[]
}

function fold(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9,\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  const map = new Map(Object.entries(row).map(([k, v]) => [fold(k).replace(/\s+/g, '_'), v]))
  for (const key of keys) {
    const hit = map.get(fold(key).replace(/\s+/g, '_'))
    if (hit != null && String(hit).trim()) return String(hit).trim()
  }
  for (const [k, v] of map) {
    for (const key of keys) {
      const want = fold(key).replace(/\s+/g, '_')
      if (k.includes(want) || want.includes(k)) {
        if (String(v || '').trim()) return String(v).trim()
      }
    }
  }
  return ''
}

function parseDateFlexible(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s || /^s\/?n$/i.test(s) || s === '-') return null
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
  }
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (mdy) {
    const y = Number(mdy[3]) + 2000
    return `${y}-${mdy[1]!.padStart(2, '0')}-${mdy[2]!.padStart(2, '0')}`
  }
  return null
}

function mesNombre(mes: number): string | null {
  const names = [
    '',
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  return names[mes] || null
}

function parseMoney(raw: string): number | null {
  const s = String(raw || '').trim()
  if (!s || s === '-' || /^s\/?n$/i.test(s) || /^no$/i.test(s)) return null
  const nums = s.replace(/\./g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/g)
  if (!nums?.length) return null
  const n = Number(nums[nums.length - 1])
  return Number.isFinite(n) ? n : null
}

/**
 * Columna "viaticos otorgados días y monto": a veces solo trae días
 * (`1 DIA - U$S`) sin cifra; no usar el conteo de días como monto.
 */
function parseOtorgadosMoney(raw: string): number | null {
  const s = String(raw || '').trim()
  if (!s || s === '-' || /^s\/?n$/i.test(s) || /^no$/i.test(s)) return null

  const withCurrency = s.match(
    /(?:U\$S|USD|EUR|€|ARS)\s*(-?[\d.]+(?:,\d+)?)/i,
  )
  if (withCurrency?.[1]) return parseMoney(withCurrency[1])

  const amountThenCurrency = s.match(
    /(-?[\d.]+(?:,\d+)?)\s*(?:U\$S|USD|EUR|€|ARS)/i,
  )
  if (amountThenCurrency?.[1]) return parseMoney(amountThenCurrency[1])

  // Solo "N DIA(S) …" sin monto explícito.
  if (/\d+\s*dias?\b/i.test(s)) return null

  return parseMoney(s)
}

function classifyViaticosCurrency(monedaRaw: string): 'USD' | 'EUR' | 'ARS' {
  const moneda = String(monedaRaw || '').toUpperCase().trim()
  if (moneda.includes('EUR') || moneda.includes('€')) return 'EUR'
  // U$S / USD antes de `$` suelto (ARS). `U$S`.includes('$') === true.
  if (
    moneda.includes('USD') ||
    moneda.includes('U$S') ||
    moneda.includes('U$') ||
    moneda.includes('DOLAR') ||
    moneda.includes('DÓLAR')
  ) {
    return 'USD'
  }
  if (
    moneda.includes('ARS') ||
    moneda.includes('PESO') ||
    moneda === '$'
  ) {
    return 'ARS'
  }
  // Histórico HCDN: vacíos / códigos raros en misiones al exterior → USD.
  return 'USD'
}

function cleanParticipa(raw: string): string {
  let s = String(raw || '').replace(/\s+/g, ' ').trim()
  s = s.replace(/^DIP\.?\s*/i, '')
  if (!s || /^s\/?n$/i.test(s)) return ''
  if (!s.includes(',') && /\s/.test(s)) {
    const tokens = s.split(/\s+/)
    if (tokens.length >= 2 && tokens[0] === tokens[0]!.toUpperCase()) {
      s = `${tokens[0]}, ${tokens.slice(1).join(' ')}`
    }
  }
  return titleCaseSpanish(s.toLowerCase())
}

function isPlaceholderRow(row: Record<string, string>): boolean {
  const motivo = pick(row, 'motivo', 'viaje_desc').toLowerCase()
  const participa = pick(row, 'participa', 'diputado_nombre').toLowerCase()
  if (motivo.includes('no se realizaron')) return true
  if (!participa || participa === 's/n') return true
  return false
}

export function rowToMisionOficial(
  row: Record<string, string>,
  recurso: MisionRecurso,
): MisionOficial | null {
  if (isPlaceholderRow(row)) return null

  const fechaInicio = parseDateFlexible(
    pick(row, 'fecha_inicio', 'fecha inicio', 'fecha_inicio_viaje', 'fecha inicio viaje'),
  )
  const fechaFin = parseDateFlexible(
    pick(row, 'fecha_fin', 'fecha fin', 'fecha_fin_viaje', 'fecha fin viaje'),
  )
  const nombre = cleanParticipa(pick(row, 'participa', 'diputado_nombre'))
  if (!nombre) return null

  const destinoParts = [
    pick(row, 'ciudad_viaje', 'ciudad'),
    pick(row, 'lugar', 'ciudad/pais', 'ciudad-pais', 'pais_destino_nombre'),
  ].filter(Boolean)
  const destino = titleCaseSpanish(
    [...new Set(destinoParts.map(p => p.replace(/\s+/g, ' ').trim()))]
      .join(', ')
      .toLowerCase(),
  ) || '—'

  const motivoRaw = pick(row, 'motivo', 'viaje_desc')
  const motivo = motivoRaw ? titleCaseSpanish(motivoRaw.toLowerCase()) : null
  const bloqueRaw = pick(row, 'bloque', 'diputado_bloque', 'bloque_nombre')
  const bloque = bloqueRaw ? titleCaseSpanish(bloqueRaw.toLowerCase()) : null

  const viaticosRaw = pick(
    row,
    'viaticos_consumidos',
    'víaticos consumidos',
    'viaticos consumidos',
    'monto_total_viaticos',
  )
  const otorgadosRaw = pick(
    row,
    'viaticos_otorgados_dias_y_monto_segun_r_p_n_1164_12',
    'viaticos otorgados',
    'viaticos_otorgados',
    'viaticos_cantidad',
  )
  const moneda = pick(row, 'moneda', 'moneda_id')
  const consumidos = parseMoney(viaticosRaw)
  const otorgados = parseOtorgadosMoney(otorgadosRaw)

  let viaticosUsd: number | null = null
  let viaticosEuro: number | null = null
  let viaticosArs: number | null = null
  const amount = consumidos ?? otorgados
  if (amount != null) {
    const currency = classifyViaticosCurrency(moneda)
    if (currency === 'EUR') viaticosEuro = amount
    else if (currency === 'ARS') viaticosArs = amount
    else viaticosUsd = amount
  }

  const anio = fechaInicio
    ? Number(fechaInicio.slice(0, 4))
    : fechaFin
      ? Number(fechaFin.slice(0, 4))
      : 0
  if (!anio) return null
  const mes = fechaInicio ? Number(fechaInicio.slice(5, 7)) : null

  const diputadoIdRaw = pick(row, 'diputado_id')
  const diputadoId = diputadoIdRaw ? diputadoIdRaw.toUpperCase() : null

  const institucionRaw = pick(
    row,
    'institucion_que_invita',
    'insituticion_que_invita',
    'institucion que invita',
  )
  const institucion = institucionRaw
    ? titleCaseSpanish(institucionRaw.toLowerCase())
    : null

  return {
    anio,
    mes: mes && mes >= 1 && mes <= 12 ? mes : null,
    mesNombre: mes && mes >= 1 && mes <= 12 ? mesNombre(mes) : null,
    documentoId: recurso.id,
    documentoUrl: recurso.url,
    recursoId: recurso.id,
    recursoUrl: recurso.url,
    recursoNombre: recurso.nombre,
    nombre,
    diputadoId,
    institucion,
    destino,
    fechaInicio,
    fechaFin,
    fechaTexto:
      fechaInicio && fechaFin && fechaInicio !== fechaFin
        ? `${fechaInicio} – ${fechaFin}`
        : fechaInicio || fechaFin,
    viaticos: amount != null ? amount > 0 : null,
    viaticosUsd,
    viaticosEuro,
    viaticosArs,
    motivo,
    bloque,
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (index < items.length) {
        const current = items[index++]
        await worker(current)
      }
    },
  )
  await Promise.all(runners)
}

export async function listMisionesCsvRecursos(): Promise<MisionRecurso[]> {
  const response = await axios.get(CKAN_PACKAGE_SHOW, {
    params: { id: MISIONES_DATASET_SLUG },
    timeout: 30_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  const resources = response.data?.result?.resources
  if (!Array.isArray(resources)) return []
  return resources
    .filter((r: any) => String(r?.format || '').toUpperCase() === 'CSV')
    .map((r: any) => ({
      id: String(r.id),
      nombre: String(r.name || r.description || r.id || '').trim(),
      url: String(r.url || '').replace(/^http:\/\//i, 'https://').replace(':443/', '/'),
    }))
    .filter((r: MisionRecurso) => Boolean(r.url))
}

async function downloadCsv(url: string): Promise<string> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  const buffer = Buffer.from(response.data)
  const utf8 = buffer.toString('utf8')
  if (!utf8.includes('\uFFFD')) return utf8
  return buffer.toString('latin1')
}

export function matchMisionesDiputadoIds(
  misiones: MisionOficial[],
  diputados: Array<{ id: string, nombre: string, apellido: string }>,
): MisionOficial[] {
  const byId = new Map(diputados.map(d => [String(d.id).toUpperCase(), d]))
  const byClave = new Map<string, string[]>()
  for (const d of diputados) {
    const clave = claveApellidoNombre(`${d.apellido}, ${d.nombre}`)
    if (!clave) continue
    const list = byClave.get(clave) || []
    list.push(String(d.id))
    byClave.set(clave, list)
  }

  for (const mision of misiones) {
    if (mision.diputadoId && byId.has(mision.diputadoId.toUpperCase())) {
      mision.diputadoId = mision.diputadoId.toUpperCase()
      continue
    }
    const clave = claveApellidoNombre(mision.nombre)
    const ids = clave ? [...new Set(byClave.get(clave) || [])] : []
    mision.diputadoId = ids.length === 1 ? ids[0]! : null
  }
  return misiones
}

export function buildMisionesEndpointMap(
  data: MisionesData,
): Record<string, unknown> {
  const endpoints: Record<string, unknown> = {
    [MISIONES_ENDPOINT]: data,
    [`${MISIONES_ENDPOINT}/lista`]: data.misiones,
  }

  const porAnio = new Map<number, MisionOficial[]>()
  for (const mision of data.misiones) {
    if (!mision.anio) continue
    const list = porAnio.get(mision.anio) || []
    list.push(mision)
    porAnio.set(mision.anio, list)
  }
  for (const [anio, misionesAnio] of [...porAnio.entries()].sort((a, b) => a[0] - b[0])) {
    endpoints[`${MISIONES_ENDPOINT}/${anio}`] = misionesAnio
  }

  const byDiputado = new Map<string, DiputadoMisiones>()
  for (const mision of data.misiones) {
    if (!mision.diputadoId) continue
    const id = String(mision.diputadoId)
    let entry = byDiputado.get(id)
    if (!entry) {
      entry = { diputadoId: id, misiones: [] }
      byDiputado.set(id, entry)
    }
    entry.misiones.push(mision)
  }
  for (const [id, entry] of [...byDiputado.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    endpoints[`/diputados/diputados/${id}/misiones`] = entry
  }

  return endpoints
}

export function writeMisionesEndpoints(data: MisionesData): void {
  const endpoints = buildMisionesEndpointMap(data)
  for (const [endpoint, payload] of Object.entries(endpoints)) {
    writeEndpoint(endpoint, payload)
  }
}

export async function crawlMisiones(): Promise<MisionesData> {
  const recursos = await listMisionesCsvRecursos()
  if (!recursos.length) {
    throw new Error('Misiones oficiales: no hay CSVs en CKAN')
  }

  const misiones: MisionOficial[] = []
  await mapPool(recursos, DOWNLOAD_CONCURRENCY, async (recurso) => {
    try {
      const csv = await downloadCsv(recurso.url)
      const rows = parseCsvText(csv)
      let n = 0
      for (const row of rows) {
        const mision = rowToMisionOficial(row, recurso)
        if (mision) {
          misiones.push(mision)
          n++
        }
      }
      console.log(`Misiones: ${recurso.nombre} → ${n} filas`)
    }
    catch (e: any) {
      console.error(`Misiones: error ${recurso.nombre}:`, e?.message || e)
    }
  })

  misiones.sort(
    (a, b) =>
      b.anio - a.anio
      || String(b.fechaInicio || '').localeCompare(String(a.fechaInicio || ''))
      || a.nombre.localeCompare(b.nombre, 'es'),
  )

  const diputados = JSON.parse(
    readEndpoint('/diputados/diputados') || readEndpoint('diputados/diputados') || '[]',
  ) as Array<{ id: string, nombre: string, apellido: string }>

  if (diputados.length) {
    matchMisionesDiputadoIds(misiones, diputados)
  }

  const matched = misiones.filter(m => m.diputadoId).length
  console.log(
    `Misiones oficiales: ${misiones.length} (${matched} matched, ${recursos.length} CSVs)`,
  )

  const data: MisionesData = {
    fuente: MISIONES_DATASET_URL,
    actualizado: new Date().toISOString(),
    recursos: recursos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    misiones,
  }

  writeMisionesEndpoints(data)
  return data
}
