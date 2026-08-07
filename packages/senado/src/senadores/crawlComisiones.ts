import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import * as cheerio from 'cheerio'

export const COMISIONES_LIST_URL
  = 'https://www.senado.gob.ar/parlamentario/comisiones/?lista=comision'

export const COMISIONES_OPEN_DATA_URL
  = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoComisiones/json/todas'

export const COMISIONES_ENDPOINT = '/senado/comisiones'

const SENADO_ORIGIN = 'https://www.senado.gob.ar'

const COMISION_CONCURRENCY = 6

export interface ComisionIntegrante {
  nombre: string
  cargo: string
  camara: 'senado' | 'diputados' | null
  senadorId: string | null
}

export interface Comision {
  id: string
  nombre: string
  tipo: string | null
  url: string
  integrantes: ComisionIntegrante[]
}

export interface SenadorComisionMeta {
  id: string
  nombre: string
  cargo: string
}

function fold(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

export async function downloadComisionesOpenData(): Promise<Array<{ nombre: string, tipo: string }>> {
  const response = await fetch(COMISIONES_OPEN_DATA_URL)
  if (!response.ok) {
    throw new Error(`Comisiones open data: HTTP ${response.status}`)
  }
  const json = await response.json()
  const rows = json?.table?.rows
  if (!Array.isArray(rows)) {
    return []
  }
  return rows.map((row: any) => ({
    nombre: String(row.NOMBRE || '').trim(),
    tipo: String(row.TIPO_COMISION || '').trim(),
  })).filter((row: { nombre: string }) => row.nombre)
}

export async function collectComisionIds(): Promise<string[]> {
  const urls = [
    COMISIONES_LIST_URL,
    'https://www.senado.gob.ar/parlamentario/comisiones/?active=permanente',
    'https://www.senado.gob.ar/parlamentario/comisiones/?active=especiales',
  ]

  const ids = new Set<string>()
  for (const url of urls) {
    const response = await fetch(url)
    if (!response.ok) {
      continue
    }
    const html = await response.text()
    for (const match of html.matchAll(/\/parlamentario\/comisiones\/info\/(\d+)/g)) {
      ids.add(match[1])
    }
  }

  return [...ids].sort((a, b) => Number(a) - Number(b))
}

function inferCamara(nombreRaw: string): 'senado' | 'diputados' | null {
  if (/\(Sen\.?\)/i.test(nombreRaw)) {
    return 'senado'
  }
  if (/\(Dip\.?\)/i.test(nombreRaw)) {
    return 'diputados'
  }
  return null
}

function cleanIntegranteNombre(nombreRaw: string): string {
  return nombreRaw
    .replace(/\(Sen\.?\)/ig, '')
    .replace(/\(Dip\.?\)/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNombreComision($: cheerio.CheerioAPI): string {
  // El h1 "Proyectos: …" suele traer el nombre oficial completo.
  const proyectos = $('h1')
    .toArray()
    .map(el => $(el).text().replace(/\s+/g, ' ').trim())
    .find(text => /^Proyectos:/i.test(text))

  if (proyectos) {
    return proyectos.replace(/^Proyectos:\s*/i, '').trim()
  }

  const infoLine = $('body')
    .text()
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .find(line => /^Comisión\b/i.test(line) && line.length < 180 && !/aprobó/i.test(line))

  if (infoLine) {
    return infoLine.replace(/^Comisión\s+/i, '').trim()
  }

  return ''
}

function matchTipo(
  nombre: string,
  openData: Array<{ nombre: string, tipo: string }>,
): string | null {
  const folded = fold(nombre)
  if (!folded) {
    return null
  }

  const exact = openData.find(row => fold(row.nombre) === folded)
  if (exact?.tipo) {
    return titleCaseSpanish(exact.tipo.toLowerCase())
  }

  // Contención laxa: el nombre de la página suele ser más corto.
  const partial = openData.find((row) => {
    const other = fold(row.nombre)
    return other.includes(folded) || folded.includes(other)
  })
  return partial?.tipo ? titleCaseSpanish(partial.tipo.toLowerCase()) : null
}

export function parseComisionHtml(
  id: string,
  html: string,
  openData: Array<{ nombre: string, tipo: string }> = [],
): Comision {
  const $ = cheerio.load(html)
  const nombre = extractNombreComision($) || `Comisión ${id}`
  const tipo = matchTipo(nombre, openData)

  const integrantes: ComisionIntegrante[] = []
  const integrantesHeading = $('h1,h2,h3')
    .filter((_, el) => $(el).text().trim().toLowerCase() === 'integrantes')
    .first()

  // La tabla está dentro de #Integrantes (hermano del h1), no como sibling directo.
  let table = $('#Integrantes table').first()
  if (!table.length && integrantesHeading.length) {
    table = integrantesHeading.nextAll().find('table').first()
  }
  if (!table.length) {
    table = $('table')
      .filter((_, el) => {
        const header = $(el).find('tr').first().text().replace(/\s+/g, ' ').toLowerCase()
        return header.includes('nombre') && header.includes('cargo')
      })
      .first()
  }

  table.find('tr').each((_, tr) => {
    const $tr = $(tr)
    const cells = $tr.find('td')
    if (cells.length < 2) {
      return
    }

    const nombreCell = cells.eq(0)
    const cargo = cells.eq(1).text().replace(/\s+/g, ' ').trim()
    const nombreRaw = nombreCell.text().replace(/\s+/g, ' ').trim()
    if (!nombreRaw || /^nombre$/i.test(nombreRaw)) {
      return
    }

    const href = nombreCell.find('a[href*="/senadores/senador/"]').attr('href') || ''
    const senadorMatch = href.match(/\/senadores\/senador\/(\d+)/)

    const senadorId = senadorMatch?.[1] || null
    integrantes.push({
      nombre: titleCaseSpanish(cleanIntegranteNombre(nombreRaw).toLowerCase()),
      cargo: titleCaseSpanish(cargo.toLowerCase()),
      camara: inferCamara(nombreRaw) || (senadorId ? 'senado' : null),
      senadorId,
    })
  })

  return {
    id: String(id),
    nombre: titleCaseSpanish(nombre.toLowerCase()),
    tipo,
    url: `${SENADO_ORIGIN}/parlamentario/comisiones/info/${id}`,
    integrantes,
  }
}

export async function scrapeComisionById(
  id: string,
  openData: Array<{ nombre: string, tipo: string }> = [],
): Promise<Comision> {
  const url = `${SENADO_ORIGIN}/parlamentario/comisiones/info/${id}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Comisión ${id}: HTTP ${response.status}`)
  }
  const html = await response.text()
  return parseComisionHtml(id, html, openData)
}

export async function crawlComisiones(): Promise<Comision[]> {
  const [ids, openData] = await Promise.all([
    collectComisionIds(),
    downloadComisionesOpenData(),
  ])

  if (ids.length === 0) {
    throw new Error('No se encontraron IDs de comisiones en el listado del Senado')
  }

  const comisiones: Comision[] = []
  await mapPool(ids, COMISION_CONCURRENCY, async (id) => {
    try {
      const comision = await scrapeComisionById(id, openData)
      comisiones.push(comision)
    }
    catch (e: any) {
      console.error(`Error scrapeando comisión ${id}:`, e?.message || e)
    }
  })

  comisiones.sort((a, b) => Number(a.id) - Number(b.id))
  writeComisionesEndpoints(comisiones)
  return comisiones
}

/** Índice + /senado/comisiones/{id} + /senado/senadores/{id}/comisiones */
export function writeComisionesEndpoints(comisiones: Comision[]): void {
  writeEndpoint(COMISIONES_ENDPOINT, comisiones)

  for (const comision of comisiones) {
    writeEndpoint(`${COMISIONES_ENDPOINT}/${comision.id}`, comision)
  }

  const bySenador = new Map<string, SenadorComisionMeta[]>()
  for (const comision of comisiones) {
    for (const integrante of comision.integrantes) {
      if (!integrante.senadorId || integrante.camara === 'diputados') {
        continue
      }
      const list = bySenador.get(integrante.senadorId) || []
      list.push({
        id: comision.id,
        nombre: comision.nombre,
        cargo: integrante.cargo,
      })
      bySenador.set(integrante.senadorId, list)
    }
  }

  for (const [senadorId, list] of [...bySenador.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    writeEndpoint(`/senado/senadores/${senadorId}/comisiones`, list)
  }
}

/**
 * Anota en senadores.meta.comisiones las membresías halladas (solo senado).
 */
export function applyComisionesMetaToSenadores<T extends {
  id: string
  meta?: { comisiones?: SenadorComisionMeta[] } | null
}>(senadores: T[], comisiones: Comision[]): T[] {
  const bySenadorId = new Map<string, SenadorComisionMeta[]>()

  for (const comision of comisiones) {
    for (const integrante of comision.integrantes) {
      if (!integrante.senadorId || integrante.camara === 'diputados') {
        continue
      }
      const list = bySenadorId.get(integrante.senadorId) || []
      list.push({
        id: comision.id,
        nombre: comision.nombre,
        cargo: integrante.cargo,
      })
      bySenadorId.set(integrante.senadorId, list)
    }
  }

  for (const senador of senadores) {
    const comisionesMeta = bySenadorId.get(String(senador.id))
    if (!comisionesMeta || comisionesMeta.length === 0) {
      continue
    }
    senador.meta = {
      ...(senador.meta || {}),
      comisiones: comisionesMeta,
    }
  }

  return senadores
}

export function readComisionesEndpoint(): Comision[] {
  const raw = readEndpoint(COMISIONES_ENDPOINT)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}
