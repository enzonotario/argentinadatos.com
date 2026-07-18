import type { ActaData } from './parseActa.ts'
import { shouldWriteFromDatabase, shouldWriteJsonFiles } from '@argentinadatos/core/src/utils/database-mode.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import * as cheerio from 'cheerio'
import { collect } from 'collect.js'
import { ActasDatabaseService } from './database/service.ts'
import { downloadPdf } from './downloadPdf.ts'
import { parseActa } from './parseActa.ts'
import { pdfTieneVotosIndividuales } from './parseVotos.ts'
import {
  fetchDetalleActaHtml,
  parseDetalleActaHtml,
  scrapeTituloFromHtml,
} from './scrapeDetalleActa.ts'

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
  const actaIds = actasRows
    .toArray()
    .map((row) => {
      const href = $(row).find('a[href*="detalleActa"]').attr('href')
      return href ? Number(href.split('/').pop()) : NaN
    })
    .filter(id => Number.isFinite(id))

  if (actaIds.length === 0) {
    console.warn(`No se encontraron actas para el año ${yearToSearch}`)
    return []
  }

  // La tabla viene ordenada de más antigua a más reciente. Un window fijo de
  // ±50 alrededor del primer ID deja afuera actas nuevas a mitad de año.
  const minActaId = Math.min(...actaIds)
  const maxActaId = Math.max(...actaIds)
  const padding = 5
  const startId = minActaId - padding
  const endId = maxActaId + padding

  const actas = await Promise.all(
    Array.from({ length: endId - startId + 1 }, (_, i) => {
      const actaId = startId + i

      return processActa(actaId, '', yearToSearch)
    }),
  )

  const validActas = actas.filter(Boolean) as ActaData[]

  if (shouldWriteJsonFiles()) {
    saveByYear(validActas, yearToSearch)
    saveAll(validActas)
  }

  const TURSO_DATABASE_URL = process.env.VITE_TURSO_DATABASE_URL
  const TURSO_AUTH_TOKEN = process.env.VITE_TURSO_AUTH_TOKEN

  if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && shouldWriteFromDatabase()) {
    const db = new ActasDatabaseService(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

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
    const finalTitulo = tituloFromHtml || titulo

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

function saveByYear(data: any, year: number) {
  if (!shouldWriteJsonFiles()) {
    return data
  }

  const currentValues = readEndpoint(`/senado/actas/${year}`) || '[]'

  const currentData = JSON.parse(currentValues)

  const newData = collect(data)
    .merge(currentData)
    .unique('actaId')
    .sortBy('actaId')
    .all()

  writeEndpoint(`/senado/actas/${year}`, newData)

  return newData
}

function saveAll(data: any) {
  if (!shouldWriteJsonFiles()) {
    return data
  }

  const currentValues = readEndpoint('/senado/actas') || '[]'

  const currentData = JSON.parse(currentValues)

  const newData = collect(data)
    .merge(currentData)
    .unique('actaId')
    .sortBy('actaId')
    .all()

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
