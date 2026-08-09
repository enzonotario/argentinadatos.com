import axios from 'axios'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { BASE_URL, USER_AGENT } from '../../constants.ts'

export const COMISIONES_DATASET_SLUG = 'comisiones'
export const COMISIONES_DATASET_URL = `${BASE_URL}/dataset/${COMISIONES_DATASET_SLUG}`
export const COMISIONES_ENDPOINT = '/diputados/comisiones'

const CKAN_PACKAGE_SHOW = `${BASE_URL}/api/3/action/package_show`

export interface ComisionIntegrante {
  nombre: string
  cargo: string
  /** Distrito electoral (provincia) según HCDN. */
  distrito: string | null
  bloque: string | null
  diputadoId: string | null
}

export interface Comision {
  id: string
  nombre: string
  tipo: string | null
  tipoCodigo: string | null
  grupo: string | null
  periodoInicio: string | null
  periodoFin: string | null
  fechaInicio: string | null
  fechaFin: string | null
  url: string
  integrantes: ComisionIntegrante[]
}

export interface DiputadoComisionMeta {
  id: string
  nombre: string
  cargo: string
}

const TIPO_LABEL: Record<string, string> = {
  P: 'Permanente',
  E: 'Especial',
  B: 'Bicameral',
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

function claveApellidoNombre(nombre: string): string | null {
  const folded = fold(nombre)
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

function toIsoDate(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
  }
  return null
}

function tipoLabel(codigo: string | null | undefined): string | null {
  const c = String(codigo || '').trim().toUpperCase()
  if (!c) return null
  return TIPO_LABEL[c] || c
}

function normalizeNombrePersona(raw: string): string {
  let s = String(raw || '').replace(/\s+/g, ' ').trim()
  s = s.replace(/^DIP\.?\s*/i, '')
  if (!s.includes(',') && s.includes(' ')) {
    // "MAYORAZ Nicolás" → "MAYORAZ, Nicolás" para title-case consistente
    const tokens = s.split(/\s+/)
    if (tokens.length >= 2) {
      s = `${tokens[0]}, ${tokens.slice(1).join(' ')}`
    }
  }
  return titleCaseSpanish(s.toLowerCase())
}

async function ckanJsonResources(): Promise<Array<{ name: string, url: string }>> {
  const response = await axios.get(CKAN_PACKAGE_SHOW, {
    params: { id: COMISIONES_DATASET_SLUG },
    timeout: 30_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  const resources = response.data?.result?.resources
  if (!Array.isArray(resources)) return []
  return resources
    .filter((r: any) => String(r?.format || '').toUpperCase() === 'JSON')
    .map((r: any) => ({
      name: String(r.name || '').trim(),
      url: String(r.url || '').replace(/^http:\/\//i, 'https://').replace(':443/', '/'),
    }))
    .filter((r: { url: string }) => Boolean(r.url))
}

function pickResource(
  resources: Array<{ name: string, url: string }>,
  pred: (name: string) => boolean,
): string | null {
  const hit = resources.find(r => pred(r.name.toLowerCase()))
  return hit?.url || null
}

async function downloadJson(url: string): Promise<any[]> {
  const response = await axios.get(url, {
    timeout: 90_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  return Array.isArray(response.data) ? response.data : []
}

export function matchDiputadoIdByNombre(
  nombre: string,
  diputados: Array<{ id: string, nombre: string, apellido: string }>,
): string | null {
  const clave = claveApellidoNombre(nombre)
  if (!clave) return null
  const hits: string[] = []
  for (const d of diputados) {
    const catalog = `${d.apellido}, ${d.nombre}`
    if (claveApellidoNombre(catalog) === clave) hits.push(String(d.id))
    else if (fold(nombre) === fold(catalog) || fold(nombre) === fold(`${d.apellido} ${d.nombre}`)) {
      hits.push(String(d.id))
    }
  }
  const uniq = [...new Set(hits)]
  return uniq.length === 1 ? uniq[0]! : null
}

export function buildComisionesFromHcdn(options: {
  catalog: Array<Record<string, unknown>>
  integrantes: Array<Record<string, unknown>>
  autoridades: Array<Record<string, unknown>>
  diputados: Array<{ id: string, nombre: string, apellido: string }>
}): Comision[] {
  const { catalog, integrantes, autoridades, diputados } = options

  const cargoByKey = new Map<string, { cargo: string, bloque: string | null }>()
  for (const row of autoridades || []) {
    const comisionId = String(row.COMISION_ID ?? row.comision_id ?? '').trim()
    const nombre = normalizeNombrePersona(String(row.DIPUTADO_NOMBRE ?? row.diputado_nombre ?? ''))
    if (!comisionId || !nombre) continue
    const cargo = titleCaseSpanish(String(row.CARGO ?? row.cargo ?? 'Vocal').toLowerCase())
    const bloqueRaw = String(row.BLOQUE ?? row.bloque ?? '').trim()
    const bloque = bloqueRaw ? titleCaseSpanish(bloqueRaw.toLowerCase()) : null
    cargoByKey.set(`${comisionId}|${fold(nombre)}`, { cargo, bloque })
  }

  const integrantesByComision = new Map<string, ComisionIntegrante[]>()
  for (const row of integrantes || []) {
    const comisionId = String(row.COMISION_ID ?? row.comision_id ?? '').trim()
    const nombre = normalizeNombrePersona(String(row.DIPUTADO_NOMBRE ?? row.diputado_nombre ?? ''))
    if (!comisionId || !nombre) continue
    const distritoRaw = String(row.DISTRITO ?? row.distrito ?? '').trim()
    const meta = cargoByKey.get(`${comisionId}|${fold(nombre)}`)
    const list = integrantesByComision.get(comisionId) || []
    list.push({
      nombre,
      cargo: meta?.cargo || 'Vocal',
      distrito: distritoRaw ? titleCaseSpanish(distritoRaw.toLowerCase()) : null,
      bloque: meta?.bloque || null,
      diputadoId: matchDiputadoIdByNombre(nombre, diputados),
    })
    integrantesByComision.set(comisionId, list)
  }

  // Autoridades sin fila en integrantes (raro, pero por si falta)
  for (const [key, meta] of cargoByKey) {
    const [comisionId, ...rest] = key.split('|')
    const folded = rest.join('|')
    const list = integrantesByComision.get(comisionId!) || []
    if (list.some(i => fold(i.nombre) === folded)) continue
    // no tenemos el nombre original title-cased fácilmente; skip
    void meta
    void list
  }

  const comisiones: Comision[] = []
  for (const row of catalog || []) {
    const id = String(row.ID ?? row.id ?? '').trim()
    const nombreRaw = String(row.NOMBRE ?? row.nombre ?? '').trim()
    if (!id || !nombreRaw) continue
    const tipoCodigo = String(row.TIPO_DE_COMISION ?? row.tipo ?? '').trim().toUpperCase() || null
    const integrantesList = (integrantesByComision.get(id) || []).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    )
    comisiones.push({
      id,
      nombre: titleCaseSpanish(nombreRaw.toLowerCase()),
      tipo: tipoLabel(tipoCodigo),
      tipoCodigo,
      grupo: String(row.GRUPO ?? row.grupo ?? '').trim() || null,
      periodoInicio: String(row.PERIODO_DE_INICIO ?? '').trim() || null,
      periodoFin: String(row.PERIODO_DE_FINALIZACION ?? '').trim() || null,
      fechaInicio: toIsoDate(String(row.FECHA_DE_INICIO ?? '')),
      fechaFin: toIsoDate(String(row.FECHA_DE_FINALIZACION ?? '')),
      url: `${COMISIONES_DATASET_URL}`,
      integrantes: integrantesList,
    })
  }

  // Comisiones solo presentes en integrantes (por si el catálogo está incompleto)
  for (const [id, list] of integrantesByComision) {
    if (comisiones.some(c => c.id === id)) continue
    comisiones.push({
      id,
      nombre: id,
      tipo: 'Permanente',
      tipoCodigo: 'P',
      grupo: 'CD',
      periodoInicio: null,
      periodoFin: null,
      fechaInicio: null,
      fechaFin: null,
      url: COMISIONES_DATASET_URL,
      integrantes: list,
    })
  }

  comisiones.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return comisiones
}

export function writeComisionesEndpoints(comisiones: Comision[]): void {
  writeEndpoint(COMISIONES_ENDPOINT, comisiones)
  for (const comision of comisiones) {
    writeEndpoint(`${COMISIONES_ENDPOINT}/${comision.id}`, comision)
  }

  const byDiputado = new Map<string, DiputadoComisionMeta[]>()
  for (const comision of comisiones) {
    for (const integrante of comision.integrantes) {
      if (!integrante.diputadoId) continue
      const list = byDiputado.get(integrante.diputadoId) || []
      list.push({
        id: comision.id,
        nombre: comision.nombre,
        cargo: integrante.cargo,
      })
      byDiputado.set(integrante.diputadoId, list)
    }
  }

  for (const [diputadoId, list] of [...byDiputado.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    writeEndpoint(`/diputados/diputados/${diputadoId}/comisiones`, list)
  }
}

export function applyComisionesMetaToDiputados<T extends {
  id: string
  meta?: { comisiones?: DiputadoComisionMeta[] } | null
}>(diputados: T[], comisiones: Comision[]): T[] {
  const byId = new Map<string, DiputadoComisionMeta[]>()
  for (const comision of comisiones) {
    for (const integrante of comision.integrantes) {
      if (!integrante.diputadoId) continue
      const list = byId.get(integrante.diputadoId) || []
      list.push({
        id: comision.id,
        nombre: comision.nombre,
        cargo: integrante.cargo,
      })
      byId.set(integrante.diputadoId, list)
    }
  }

  for (const d of diputados) {
    const list = byId.get(String(d.id))
    if (!list?.length) continue
    d.meta = { ...(d.meta || {}), comisiones: list }
  }
  return diputados
}

export async function crawlComisiones(): Promise<Comision[]> {
  const resources = await ckanJsonResources()
  const catalogUrl = pickResource(resources, n => n === 'comisiones')
  const integrantesUrl = pickResource(
    resources,
    n => n.includes('integrantes') && !n.includes('bloque') && !n.includes('género') && !n.includes('genero'),
  )
  const autoridadesUrl = pickResource(resources, n => n.includes('autoridades'))

  if (!catalogUrl || !integrantesUrl) {
    throw new Error('Comisiones diputados: faltan recursos JSON (catálogo/integrantes)')
  }

  const [catalog, integrantes, autoridades] = await Promise.all([
    downloadJson(catalogUrl),
    downloadJson(integrantesUrl),
    autoridadesUrl ? downloadJson(autoridadesUrl) : Promise.resolve([]),
  ])

  const diputados = JSON.parse(
    readEndpoint('/diputados/diputados')
    || readEndpoint('diputados/diputados')
    || '[]',
  ) as Array<{
    id: string
    nombre: string
    apellido: string
  }>

  const comisiones = buildComisionesFromHcdn({
    catalog,
    integrantes,
    autoridades,
    diputados,
  })
  if (!comisiones.length) {
    throw new Error('Comisiones diputados: sin filas válidas')
  }

  writeComisionesEndpoints(comisiones)
  console.log(
    `Comisiones diputados: ${comisiones.length} (${integrantes.length} integrantes, ${autoridades.length} autoridades)`,
  )
  return comisiones
}
