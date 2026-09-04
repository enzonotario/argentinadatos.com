import type { ActaData } from './parseActa.ts'
import { shouldWriteFromDatabase, shouldWriteJsonFiles } from '@argentinadatos/core/src/utils/database-mode.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import * as cheerio from 'cheerio'
import { ActasDatabaseService } from './database/service.ts'
import { downloadPdf } from './downloadPdf.ts'
import { parseActa } from './parseActa.ts'
import { pdfTieneVotosIndividuales } from './parseVotos.ts'
import {
  fetchDetalleActaHtml,
  parseDetalleActaHtml,
  scrapeTituloFromHtml,
} from './scrapeDetalleActa.ts'

/** Evita tumbar senado.gob.ar con ~200 GETs en paralelo (fallan las actas nuevas). */
const ACTA_CONCURRENCY = 6
/** Mirar un poco más allá del max del listado por si hay actas recién publicadas. */
const FORWARD_PADDING = 10

export async function crawlActas({ year }: { year?: number } = {}): Promise<
  ActaData[]
> {
  const yearToSearch = year || new Date().getFullYear()

  const response = await fetch('https://www.senado.gob.ar/votaciones/actas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `busqueda_actas%5Banio%5D=${yearToSearch}&busqueda_actas%5Btitulo%5D=&x=42&y=8`,
  })

  const html = await response.text()

  const $ = cheerio.load(html)

  const actasRows = $('table#actasTable tbody tr')

  // Cada fila tiene varios <a> (expedientes sin href, OD, PDF, detalle, video).
  // Hay que tomar específicamente el link a detalleActa; el primero de la fila
  // suele ser "Ver Expedientes" sin href → Number(undefined) === NaN.
  const listed = collectListedActas($, actasRows)
  const listedIds = listed.map(row => row.id)

  if (listedIds.length === 0) {
    console.warn(`No se encontraron actas para el año ${yearToSearch}`)
    return []
  }

  const idsToProcess = buildActaIdsToProcess(listedIds, FORWARD_PADDING)
  const knownTitulos = new Map(listed.map(row => [row.id, row.titulo]))
  const existingIds = loadExistingActaIds(yearToSearch)

  // Priorizar actas que aún no están en el índice local (p.ej. sesión del 27/08).
  idsToProcess.sort((a, b) => {
    const aMiss = existingIds.has(a) ? 1 : 0
    const bMiss = existingIds.has(b) ? 1 : 0
    if (aMiss !== bMiss) return aMiss - bMiss
    return a - b
  })

  console.log(
    `Actas ${yearToSearch}: ${listedIds.length} en listado, `
    + `${idsToProcess.length} a procesar `
    + `(ids ${Math.min(...idsToProcess)}–${Math.max(...idsToProcess)}), `
    + `${idsToProcess.filter(id => !existingIds.has(id)).length} nuevas`,
  )

  const validActas: ActaData[] = []
  await mapPool(idsToProcess, ACTA_CONCURRENCY, async (actaId) => {
    const acta = await processActa(
      actaId,
      knownTitulos.get(actaId) || '',
      yearToSearch,
    )
    if (acta) validActas.push(acta)
  })

  validActas.sort((a, b) => Number(a.actaId) - Number(b.actaId))

  if (shouldWriteJsonFiles()) {
    saveByYear(validActas, yearToSearch)
    saveAll(validActas)
  }

  const POCKETBASE_URL = process.env.POCKETBASE_URL
  const POCKETBASE_TOKEN = process.env.POCKETBASE_TOKEN

  if (POCKETBASE_TOKEN && shouldWriteFromDatabase()) {
    const db = new ActasDatabaseService(POCKETBASE_URL, POCKETBASE_TOKEN)

    try {
      await db.initialize()

      const timestamp = new Date().toISOString()

      const itemsToInsert = validActas
        .filter(acta => acta.actaId)
        .map(acta => ({
          actaId: acta.actaId!,
          año: yearToSearch,
          data: acta,
          timestamp,
        }))

      await db.insertBatchActas(itemsToInsert)

      await generateEndpointEstatico(db, yearToSearch)
      await generateEndpointEstaticoAll(db)
    }
    finally {
      db.close()
    }
  }

  return validActas
}

export function collectListedActas(
  $: cheerio.CheerioAPI,
  actasRows: cheerio.Cheerio<any>,
): Array<{ id: number, titulo: string }> {
  const byId = new Map<number, string>()

  for (const row of actasRows.toArray()) {
    const $row = $(row)
    const href = $row.find('a[href*="detalleActa"]').attr('href')
    if (!href) continue
    const id = Number(href.split('/').pop())
    if (!Number.isFinite(id)) continue

    // Columna Título: suele ser la 3ra (índice 2).
    const titulo = $row.find('td').eq(2).text().replace(/\s+/g, ' ').trim()
    if (!byId.has(id) || titulo) {
      byId.set(id, titulo)
    }
  }

  return [...byId.entries()]
    .map(([id, titulo]) => ({ id, titulo }))
    .sort((a, b) => a.id - b.id)
}

/**
 * IDs del listado + ventana hacia adelante (actas recién publicadas).
 * No rellena huecos internos: eso disparaba ~80 PDFs ajenos al año y
 * saturaba el sitio con Promise.all.
 */
export function buildActaIdsToProcess(
  listedIds: number[],
  forwardPadding = FORWARD_PADDING,
): number[] {
  const unique = [...new Set(listedIds.filter(id => Number.isFinite(id)))]
  if (!unique.length) return []

  const maxId = Math.max(...unique)
  const forward = Array.from(
    { length: Math.max(0, forwardPadding) },
    (_, i) => maxId + 1 + i,
  )

  return [...new Set([...unique, ...forward])].sort((a, b) => a - b)
}

function loadExistingActaIds(year: number): Set<number> {
  try {
    const raw = readEndpoint(`/senado/actas/${year}`) || '[]'
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return new Set()
    return new Set(
      list
        .map((a: any) => Number(a?.actaId))
        .filter((id: number) => Number.isFinite(id)),
    )
  }
  catch {
    return new Set()
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

async function processActa(
  actaId: number,
  titulo: string,
  yearToSearch: number,
): Promise<ActaData | null> {
  try {
    const pdfPath = await downloadPdf(actaId)

    if (!pdfPath) {
      return null
    }

    let html = ''
    try {
      html = await fetchDetalleActaHtml(actaId)
    }
    catch (error) {
      console.error(`❌ Error al obtener HTML del Acta ${actaId}:`, error)
    }

    const tituloFromHtml = html ? scrapeTituloFromHtml(html) : ''
    const finalTitulo =
      tituloFromHtml ||
      titulo ||
      readExistingTitulo(actaId, yearToSearch)

    const tieneVotosPdf = await pdfTieneVotosIndividuales(pdfPath)

    let acta: ActaData
    if (tieneVotosPdf) {
      acta = await parseActa(actaId, finalTitulo, pdfPath)
    }
    else if (html) {
      console.log(`📄 Acta ${actaId}: PDF sin votos individuales, scrapeando HTML`)
      acta = parseDetalleActaHtml(html, actaId, finalTitulo)
    }
    else {
      acta = await parseActa(actaId, finalTitulo, pdfPath)
    }

    if (shouldWriteJsonFiles()) {
      writeEndpoint(`/senado/actas/${yearToSearch}/${actaId}`, acta)
    }

    return acta
  }
  catch (error) {
    console.error(`❌ Error al procesar Acta ${actaId}:`, error)

    return null
  }
}

function readExistingTitulo(actaId: number, year: number): string {
  try {
    const rawDetail = readEndpoint(`/senado/actas/${year}/${actaId}`)
    if (rawDetail) {
      const detail = JSON.parse(rawDetail)
      const t = String(detail?.titulo || '').trim()
      if (t) return t
    }
  }
  catch {
    // ignore
  }

  try {
    const rawYear = readEndpoint(`/senado/actas/${year}`) || '[]'
    const list = JSON.parse(rawYear)
    if (Array.isArray(list)) {
      const found = list.find((a: any) => Number(a?.actaId) === actaId)
      const t = String(found?.titulo || '').trim()
      if (t) return t
    }
  }
  catch {
    // ignore
  }

  return ''
}

/**
 * Merge por actaId: la entrada nueva gana, pero no pisa un título bueno
 * con string vacío (el scrape HTML a veces falla bajo carga paralela).
 */
function mergeActasById(incoming: ActaData[], existing: any[]): ActaData[] {
  const byId = new Map<number, any>()

  for (const acta of existing || []) {
    if (acta?.actaId == null) continue
    byId.set(Number(acta.actaId), acta)
  }

  for (const acta of incoming || []) {
    if (acta?.actaId == null) continue
    const id = Number(acta.actaId)
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, acta)
      continue
    }

    const newTitulo = String(acta.titulo || '').trim()
    const prevTitulo = String(prev.titulo || '').trim()

    byId.set(id, {
      ...prev,
      ...acta,
      titulo: newTitulo || prevTitulo || acta.titulo || '',
    })
  }

  return [...byId.values()].sort(
    (a, b) => Number(a.actaId) - Number(b.actaId),
  )
}

function saveByYear(data: any, year: number) {
  if (!shouldWriteJsonFiles()) {
    return data
  }

  const currentValues = readEndpoint(`/senado/actas/${year}`) || '[]'
  const currentData = JSON.parse(currentValues)
  const newData = mergeActasById(data, currentData)

  writeEndpoint(`/senado/actas/${year}`, newData)

  return newData
}

function saveAll(data: any) {
  if (!shouldWriteJsonFiles()) {
    return data
  }

  const currentValues = readEndpoint('/senado/actas') || '[]'
  const currentData = JSON.parse(currentValues)
  const newData = mergeActasById(data, currentData)

  writeEndpoint('/senado/actas', newData)
}

async function generateEndpointEstatico(db: ActasDatabaseService, año: number) {
  const todosLosDatos = await db.getActasByAño(año)

  writeEndpoint(`/senado/actas/${año}`, todosLosDatos)
}

async function generateEndpointEstaticoAll(db: ActasDatabaseService) {
  const todosLosDatos = await db.getAllActas()

  writeEndpoint('/senado/actas', todosLosDatos)
}
