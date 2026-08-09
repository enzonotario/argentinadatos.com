import axios from 'axios'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { BASE_URL, USER_AGENT } from '../../constants.ts'

export const VIAJES_DATASET_SLUG = 'viajes-nacionales'
export const VIAJES_DATASET_URL = `${BASE_URL}/dataset/${VIAJES_DATASET_SLUG}`
export const VIAJES_ENDPOINT = '/diputados/viajes'
export const VIAJES_CONTEO_12M_ENDPOINT = `${VIAJES_ENDPOINT}/conteo-12m`
export const VIAJES_CONTEO_ENDPOINT = `${VIAJES_ENDPOINT}/conteo`

const CKAN_PACKAGE_SHOW = `${BASE_URL}/api/3/action/package_show`
const DOWNLOAD_CONCURRENCY = 4

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
}

export interface ViajeRecurso {
  id: string
  nombre: string
  url: string
  anio: number | null
  semestre: 1 | 2 | null
}

export interface ViajeNacional {
  ambito: 'nacional'
  anio: number
  mes: number
  mesNombre: string
  recursoId: string
  recursoUrl: string
  recursoNombre: string
  nombre: string
  diputadoId: string | null
  tipoSolicitud: string | null
  origen: string
  origenCodigo: string | null
  destino: string
  destinoCodigo: string | null
  provincia: string | null
  bloque: string | null
}

export interface ViajeInternacional {
  ambito: 'internacional'
  anio: number
  mes: number | null
  mesNombre: string | null
  /** ID del recurso CSV HCDN (misiones oficiales). */
  documentoId: string
  documentoUrl: string
  recursoId?: string
  recursoUrl?: string
  recursoNombre?: string
  nombre: string
  senadorId: string | null
  diputadoId: string | null
  expediente: string
  destino: string
  fechaInicio: string | null
  fechaFin: string | null
  fechaTexto: string | null
  asistenciaAlViajero: boolean | null
  viaticos: boolean | null
  viaticosUsd: number | null
  viaticosEuro: number | null
  viaticosArs: number | null
  motivo: string | null
  bloque: string | null
}

export interface ViajesData {
  fuente: string
  actualizado: string
  recursos: ViajeRecurso[]
  nacionales: ViajeNacional[]
  /** Misiones oficiales HCDN (viajes al exterior). */
  internacionales: ViajeInternacional[]
}

export interface ViajesConteoDiputado {
  nacionales: number
  internacionales: number
  total: number
}

export interface ViajesConteo12m {
  ventanaMeses: 12
  desde: { anio: number, mes: number }
  hasta: { anio: number, mes: number }
  actualizado: string
  porDiputado: Record<string, ViajesConteoDiputado>
}

export type ViajesConteoTotal = {
  actualizado: string
  porDiputado: Record<string, ViajesConteoDiputado>
}

export interface DiputadoViajes {
  diputadoId: string
  nacionales: ViajeNacional[]
  internacionales: ViajeInternacional[]
}

function foldNombre(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9,\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Clave apellido|primerNombre para match fuzzy. */
export function claveApellidoNombre(nombre: string): string | null {
  const folded = foldNombre(nombre)
  if (!folded) return null

  let apellidos: string[]
  let nombres: string[]
  if (folded.includes(',')) {
    const [apellidoRaw, ...rest] = folded.split(',')
    apellidos = apellidoRaw.trim().split(/\s+/).filter(Boolean)
    nombres = rest.join(',').trim().split(/\s+/).filter(Boolean)
  }
  else {
    const tokens = folded.split(/\s+/).filter(Boolean)
    apellidos = tokens.slice(0, 1)
    nombres = tokens.slice(1)
  }
  if (!apellidos[0] || !nombres[0]) return null
  return `${apellidos[0]}|${nombres[0]}`
}

export function matchViajeNombre(
  rowNombre: string,
  apellido: string,
  nombre: string,
): boolean {
  const catalog = `${apellido}, ${nombre}`
  if (foldNombre(rowNombre) === foldNombre(catalog)) return true
  if (foldNombre(rowNombre) === foldNombre(`${apellido} ${nombre}`)) return true
  const a = claveApellidoNombre(rowNombre)
  const b = claveApellidoNombre(catalog)
  return Boolean(a && b && a === b)
}

function mesNombreFromNumero(mes: number): string {
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
  return names[mes] || String(mes)
}

function anioMesToIndex(anio: number, mes: number): number {
  return anio * 12 + mes
}

function indexToAnioMes(index: number): { anio: number, mes: number } {
  const anio = Math.floor((index - 1) / 12)
  const mes = ((index - 1) % 12) + 1
  return { anio, mes }
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

/** Extrae año/semestre del nombre del recurso CKAN. */
export function parseRecursoMeta(nombre: string): {
  anio: number | null
  semestre: 1 | 2 | null
} {
  const n = String(nombre || '')
  const anioMatch = n.match(/(20\d{2})/)
  const anio = anioMatch ? Number(anioMatch[1]) : null
  let semestre: 1 | 2 | null = null
  if (/1\s*(er|er\.|erº|º)?\s*semestre|primer\s+semestre|1\s*trimestre/i.test(n)) {
    semestre = 1
  }
  else if (/2\s*(do|do\.|º)?\s*semestre|segundo\s+semestre/i.test(n)) {
    semestre = 2
  }
  return { anio, semestre }
}

/** Parsea el campo período de cada fila CSV. */
export function parsePeriodoCelda(
  raw: string,
  fallback: { anio: number | null, semestre: 1 | 2 | null },
): { anio: number, mes: number } | null {
  const value = String(raw || '').trim()
  if (value) {
    // 2024-12-01
    const iso = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
    if (iso) {
      const anio = Number(iso[1])
      const mes = Number(iso[2])
      if (anio >= 2000 && mes >= 1 && mes <= 12) return { anio, mes }
    }

    // jun-26 / JUN-2026
    const abbr = value.match(/^([A-Za-zÁÉÍÓÚáéíóú]+)\s*[-/]\s*(\d{2}|\d{4})$/)
    if (abbr) {
      const mesKey = foldNombre(abbr[1]!).slice(0, 3)
      const mes = MESES[mesKey] || MESES[foldNombre(abbr[1]!)]
      let anio = Number(abbr[2])
      if (anio < 100) anio += 2000
      if (mes && anio >= 2000) return { anio, mes }
    }

    // 2021 - ENERO / 2021 ENERO
    const mesAnio = value.match(/^(20\d{2})\s*[-–]?\s*([A-Za-zÁÉÍÓÚáéíóú]+)$/i)
      || value.match(/^([A-Za-zÁÉÍÓÚáéíóú]+)\s+(20\d{2})$/i)
    if (mesAnio) {
      const a = mesAnio[1]!
      const b = mesAnio[2]!
      const anio = /^\d{4}$/.test(a) ? Number(a) : Number(b)
      const mesRaw = /^\d{4}$/.test(a) ? b : a
      const mes = MESES[foldNombre(mesRaw)] || MESES[foldNombre(mesRaw).slice(0, 3)]
      if (mes && anio >= 2000) return { anio, mes }
    }
  }

  if (fallback.anio) {
    const mes = fallback.semestre === 2 ? 12 : fallback.semestre === 1 ? 6 : 6
    return { anio: fallback.anio, mes }
  }
  return null
}

function normalizeHeader(h: string): string {
  return foldNombre(h).replace(/\s+/g, '_').replace(/\./g, '_')
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      }
      else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

export function parseCsvText(csv: string): Record<string, string>[] {
  const text = csv.replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0]!).map(normalizeHeader)
  const rows: Record<string, string>[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    if (cells.every(c => !c)) continue
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]!] = cells[i] || ''
    }
    rows.push(row)
  }
  return rows
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const want = normalizeHeader(key)
    const v = row[want]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

export function rowToViajeNacional(
  row: Record<string, string>,
  recurso: ViajeRecurso,
): ViajeNacional | null {
  const nombre = pick(
    row,
    'diputados',
    'diputado',
    'funcionario',
    'persona_apellido_y_nombre',
  )
  if (!nombre) return null

  const periodoRaw = pick(row, 'periodo', 'mes')
  const am = parsePeriodoCelda(periodoRaw, {
    anio: recurso.anio,
    semestre: recurso.semestre,
  })
  if (!am) return null

  const tipoSolicitud = pick(row, 'tipo_solicitud', 'tipo solicitud', 'tramo') || null
  const provincia = pick(row, 'provincia') || null
  const bloque = pick(row, 'bloque') || null
  const personaId = pick(row, 'persona_id') || null

  let origen = ''
  let origenCodigo: string | null = null
  let destino = ''
  let destinoCodigo: string | null = null

  // Schema 2018: ciudad + código IATA en columnas separadas.
  if (personaId || row.origen_aeropuerto_estacion != null || row.destino_aeropuerto_estacion != null) {
    origen = pick(row, 'origen_ciudad') || pick(row, 'origen')
    origenCodigo = pick(row, 'origen_aeropuerto_estacion') || null
    destino = pick(row, 'destino_ciudad') || pick(row, 'destino')
    destinoCodigo = pick(row, 'destino_aeropuerto_estacion') || null
  }
  else {
    // Schema moderno / 2021+: ORIGEN/DESTINO (+ a veces columna de código mal nombrada).
    origen = pick(row, 'origen')
    destino = pick(row, 'destino')
    const origenExtra = pick(row, 'origen_ciudad')
    const destinoExtra = pick(row, 'destino_ciudad')
    if (origenExtra && /^[A-Z]{3}$/i.test(origenExtra)) {
      origenCodigo = origenExtra.toUpperCase()
    }
    if (destinoExtra && /^[A-Z]{3}$/i.test(destinoExtra)) {
      destinoCodigo = destinoExtra.toUpperCase()
    }
    if (!origenCodigo && origen && /^[A-Z]{3}$/i.test(origen)) {
      origenCodigo = origen.toUpperCase()
    }
    if (!destinoCodigo && destino && /^[A-Z]{3}$/i.test(destino)) {
      destinoCodigo = destino.toUpperCase()
    }
  }

  if (!origen && !destino) return null

  return {
    ambito: 'nacional',
    anio: am.anio,
    mes: am.mes,
    mesNombre: mesNombreFromNumero(am.mes),
    recursoId: recurso.id,
    recursoUrl: recurso.url,
    recursoNombre: recurso.nombre,
    nombre: titleCaseSpanish(nombre.toLowerCase()),
    diputadoId: personaId && /^HCDN/i.test(personaId) ? personaId.toUpperCase() : null,
    tipoSolicitud: tipoSolicitud
      ? titleCaseSpanish(tipoSolicitud.toLowerCase())
      : null,
    origen: origen ? titleCaseSpanish(origen.toLowerCase()) : '',
    origenCodigo: origenCodigo ? origenCodigo.toUpperCase() : null,
    destino: destino ? titleCaseSpanish(destino.toLowerCase()) : '',
    destinoCodigo: destinoCodigo ? destinoCodigo.toUpperCase() : null,
    provincia: provincia ? titleCaseSpanish(provincia.toLowerCase()) : null,
    bloque: bloque ? titleCaseSpanish(bloque.toLowerCase()) : null,
  }
}

export async function listViajesCsvRecursos(): Promise<ViajeRecurso[]> {
  const response = await axios.get(CKAN_PACKAGE_SHOW, {
    params: { id: VIAJES_DATASET_SLUG },
    timeout: 30_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  const resources = response.data?.result?.resources
  if (!Array.isArray(resources)) return []

  return resources
    .filter((r: any) => String(r?.format || '').toUpperCase() === 'CSV')
    .map((r: any) => {
      const nombre = String(r.name || r.description || r.id || '').trim()
      const meta = parseRecursoMeta(nombre)
      return {
        id: String(r.id),
        nombre,
        url: String(r.url || '').replace(/^http:\/\//i, 'https://').replace(':443/', '/'),
        anio: meta.anio,
        semestre: meta.semestre,
      } satisfies ViajeRecurso
    })
    .filter((r: ViajeRecurso) => Boolean(r.url))
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
  // fallback latin1
  return buffer.toString('latin1')
}

export function matchViajesDiputadoIds(
  viajes: ViajeNacional[],
  diputados: Array<{ id: string, nombre: string, apellido: string }>,
): ViajeNacional[] {
  const byId = new Map(diputados.map(d => [String(d.id).toUpperCase(), d]))
  const byClave = new Map<string, string[]>()
  for (const d of diputados) {
    const clave = claveApellidoNombre(`${d.apellido}, ${d.nombre}`)
    if (!clave) continue
    const list = byClave.get(clave) || []
    list.push(String(d.id))
    byClave.set(clave, list)
  }

  for (const viaje of viajes) {
    if (viaje.diputadoId && byId.has(viaje.diputadoId.toUpperCase())) {
      viaje.diputadoId = viaje.diputadoId.toUpperCase()
      continue
    }

    const clave = claveApellidoNombre(viaje.nombre)
    const ids = clave ? [...new Set(byClave.get(clave) || [])] : []
    viaje.diputadoId = ids.length === 1 ? ids[0]! : null
  }
  return viajes
}

export function buildViajesConteo12m(
  data: Pick<ViajesData, 'nacionales' | 'internacionales'>,
  asOf: Date = new Date(),
): ViajesConteo12m {
  const hastaAnio = asOf.getUTCFullYear()
  const hastaMes = asOf.getUTCMonth() + 1
  const hastaIdx = anioMesToIndex(hastaAnio, hastaMes)
  const desdeIdx = hastaIdx - 11
  const desde = indexToAnioMes(desdeIdx)
  const hasta = { anio: hastaAnio, mes: hastaMes }
  const porDiputado: Record<string, ViajesConteoDiputado> = {}

  const bump = (diputadoId: string | null | undefined, kind: 'nacionales' | 'internacionales') => {
    if (!diputadoId) return
    const id = String(diputadoId)
    const entry = porDiputado[id] || { nacionales: 0, internacionales: 0, total: 0 }
    entry[kind] += 1
    entry.total += 1
    porDiputado[id] = entry
  }

  for (const viaje of data.nacionales) {
    if (viaje.mes < 1 || viaje.mes > 12) continue
    const idx = anioMesToIndex(viaje.anio, viaje.mes)
    if (idx < desdeIdx || idx > hastaIdx) continue
    bump(viaje.diputadoId, 'nacionales')
  }

  for (const viaje of data.internacionales || []) {
    let anio = viaje.anio
    let mes = viaje.mes
    if (viaje.fechaInicio && /^\d{4}-\d{2}/.test(viaje.fechaInicio)) {
      anio = Number(viaje.fechaInicio.slice(0, 4))
      mes = Number(viaje.fechaInicio.slice(5, 7))
    }
    if (!anio || !mes || mes < 1 || mes > 12) continue
    const idx = anioMesToIndex(anio, mes)
    if (idx < desdeIdx || idx > hastaIdx) continue
    bump(viaje.diputadoId, 'internacionales')
  }

  return {
    ventanaMeses: 12,
    desde,
    hasta,
    actualizado: asOf.toISOString().slice(0, 10),
    porDiputado,
  }
}

export function buildViajesConteoTotal(
  data: Pick<ViajesData, 'nacionales' | 'internacionales'>,
  asOf: Date = new Date(),
): ViajesConteoTotal {
  const porDiputado: Record<string, ViajesConteoDiputado> = {}
  for (const viaje of data.nacionales) {
    if (!viaje.diputadoId) continue
    const id = String(viaje.diputadoId)
    const entry = porDiputado[id] || { nacionales: 0, internacionales: 0, total: 0 }
    entry.nacionales += 1
    entry.total += 1
    porDiputado[id] = entry
  }
  for (const viaje of data.internacionales || []) {
    if (!viaje.diputadoId) continue
    const id = String(viaje.diputadoId)
    const entry = porDiputado[id] || { nacionales: 0, internacionales: 0, total: 0 }
    entry.internacionales += 1
    entry.total += 1
    porDiputado[id] = entry
  }
  return {
    actualizado: asOf.toISOString().slice(0, 10),
    porDiputado,
  }
}

export function buildViajesEndpointMap(
  data: ViajesData,
  diputadoIds: string[] = [],
): Record<string, unknown> {
  const endpoints: Record<string, unknown> = {
    [VIAJES_ENDPOINT]: data,
    [`${VIAJES_ENDPOINT}/nacionales`]: data.nacionales,
    [`${VIAJES_ENDPOINT}/internacionales`]: data.internacionales,
    [VIAJES_CONTEO_12M_ENDPOINT]: buildViajesConteo12m(data),
    [VIAJES_CONTEO_ENDPOINT]: buildViajesConteoTotal(data),
  }

  const porAnio = new Map<number, ViajeNacional[]>()
  for (const viaje of data.nacionales) {
    const list = porAnio.get(viaje.anio) || []
    list.push(viaje)
    porAnio.set(viaje.anio, list)
  }
  for (const [anio, viajesAnio] of [...porAnio.entries()].sort((a, b) => a[0] - b[0])) {
    endpoints[`${VIAJES_ENDPOINT}/nacionales/${anio}`] = viajesAnio
    const porMes = new Map<number, ViajeNacional[]>()
    for (const viaje of viajesAnio) {
      const list = porMes.get(viaje.mes) || []
      list.push(viaje)
      porMes.set(viaje.mes, list)
    }
    for (const [mes, viajesMes] of [...porMes.entries()].sort((a, b) => a[0] - b[0])) {
      endpoints[`${VIAJES_ENDPOINT}/nacionales/${anio}/${mes}`] = viajesMes
    }
  }

  const intlPorAnio = new Map<number, ViajeInternacional[]>()
  for (const viaje of data.internacionales || []) {
    if (!viaje.anio) continue
    const list = intlPorAnio.get(viaje.anio) || []
    list.push(viaje)
    intlPorAnio.set(viaje.anio, list)
  }
  for (const [anio, viajesAnio] of [...intlPorAnio.entries()].sort((a, b) => a[0] - b[0])) {
    endpoints[`${VIAJES_ENDPOINT}/internacionales/${anio}`] = viajesAnio
  }

  const byDiputado = new Map<string, DiputadoViajes>()
  const ensure = (id: string): DiputadoViajes => {
    let entry = byDiputado.get(id)
    if (!entry) {
      entry = { diputadoId: id, nacionales: [], internacionales: [] }
      byDiputado.set(id, entry)
    }
    return entry
  }
  for (const viaje of data.nacionales) {
    if (!viaje.diputadoId) continue
    ensure(String(viaje.diputadoId)).nacionales.push(viaje)
  }
  for (const viaje of data.internacionales || []) {
    if (!viaje.diputadoId) continue
    ensure(String(viaje.diputadoId)).internacionales.push(viaje)
  }
  void diputadoIds
  for (const [id, entry] of [...byDiputado.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    endpoints[`/diputados/diputados/${id}/viajes`] = entry
  }

  return endpoints
}

export function writeViajesEndpoints(
  data: ViajesData,
  diputadoIds: string[] = [],
): void {
  const endpoints = buildViajesEndpointMap(data, diputadoIds)
  for (const [endpoint, payload] of Object.entries(endpoints)) {
    writeEndpoint(endpoint, payload)
  }
}

export async function crawlViajes(): Promise<ViajesData> {
  const { crawlMisionesOficiales, matchMisionesDiputadoIds } = await import(
    './crawlMisiones.ts'
  )

  const recursos = await listViajesCsvRecursos()
  if (!recursos.length) {
    throw new Error('Viajes diputados: no se encontraron recursos CSV en CKAN')
  }

  const nacionales: ViajeNacional[] = []
  await mapPool(recursos, DOWNLOAD_CONCURRENCY, async (recurso) => {
    try {
      const csv = await downloadCsv(recurso.url)
      const rows = parseCsvText(csv)
      for (const row of rows) {
        const viaje = rowToViajeNacional(row, recurso)
        if (viaje) nacionales.push(viaje)
      }
      console.log(`Viajes diputados: ${recurso.nombre} → ${rows.length} filas`)
    }
    catch (e: any) {
      console.error(`Viajes diputados: error en ${recurso.nombre}:`, e?.message || e)
    }
  })

  nacionales.sort(
    (a, b) =>
      a.anio - b.anio
      || a.mes - b.mes
      || a.nombre.localeCompare(b.nombre, 'es'),
  )

  const diputados = JSON.parse(
    readEndpoint('/diputados/diputados') || readEndpoint('diputados/diputados') || '[]',
  ) as Array<{ id: string, nombre: string, apellido: string }>

  if (diputados.length) {
    matchViajesDiputadoIds(nacionales, diputados)
  }

  let internacionales: ViajeInternacional[] = []
  try {
    internacionales = await crawlMisionesOficiales()
    if (diputados.length) {
      matchMisionesDiputadoIds(internacionales, diputados)
    }
  }
  catch (e: any) {
    console.error('Misiones oficiales: no se pudo scrapear', e?.message || e)
  }

  const matchedNat = nacionales.filter(v => v.diputadoId).length
  const matchedIntl = internacionales.filter(v => v.diputadoId).length
  console.log(
    `Viajes diputados: ${nacionales.length} nacionales (${matchedNat} matched), `
    + `${internacionales.length} internacionales/misiones (${matchedIntl} matched)`,
  )

  const data: ViajesData = {
    fuente: VIAJES_DATASET_URL,
    actualizado: new Date().toISOString(),
    recursos: recursos.sort(
      (a, b) => (a.anio || 0) - (b.anio || 0) || (a.semestre || 0) - (b.semestre || 0),
    ),
    nacionales,
    internacionales,
  }

  writeViajesEndpoints(
    data,
    diputados.map(d => String(d.id)),
  )
  return data
}
