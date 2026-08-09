import { getStaticPublicUrl } from '@argentinadatos/core/src/utils/getStaticPublicUrl.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { readStaticBuffer } from '@argentinadatos/core/src/utils/readStaticBuffer.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'
import { shouldWriteJsonFiles, shouldWriteFromDatabase } from '@argentinadatos/core/src/utils/database-mode.ts'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { formatISO, isValid, parse, parseISO } from 'date-fns'
import iconv from 'iconv-lite'
import { BASE_URL, USER_AGENT } from '../../constants.ts'
import { DiputadosDatabaseService } from './database/service.ts'
import {
  applyComisionesMetaToDiputados,
  crawlComisiones,
} from '../comisiones/crawlComisiones.ts'
import { crawlViajes } from '../viajes/crawlViajes.ts'
import { crawlPeriodos } from '../periodos/crawlPeriodos.ts'

export interface Diputado {
  id: string
  nombre: string
  apellido: string
  genero: string
  provincia: string
  periodoMandato: {
    inicio: string | null
    fin: string | null
  }
  juramentoFecha: string
  ceseFecha: string
  bloque: string
  periodoBloque: {
    inicio: string | null
    fin: string | null
  }
  foto: string | null
  meta?: {
    comisiones?: Array<{ id: string, nombre: string, cargo: string }>
  } | null
}

const currentValues = JSON.parse(
  readEndpoint('diputados/diputados') || '[]',
) as Diputado[]

const DATASET_SLUG = 'legisladores'
const CKAN_PACKAGE_SHOW = `${BASE_URL}/api/3/action/package_show`

export async function crawlDiputados(): Promise<Diputado[]> {
  const newValues = await fetchLegisladores()

  // Un mandato por (id, inicio). Preferimos el renglón con bloque más reciente
  // (cambios de bloque dentro del mismo mandato).
  const values = uniqueByMandato([
    ...currentValues,
    ...newValues,
  ]).sort((a, b) => {
    const idCmp = String(a.id).localeCompare(String(b.id))
    if (idCmp !== 0) return idCmp
    return String(a.periodoMandato?.inicio || '').localeCompare(
      String(b.periodoMandato?.inicio || ''),
    )
  })

  const diputados = []

  for (const value of values) {
    diputados.push(
      await enhanceWithPhoto(value),
    )
  }

  if (shouldWriteJsonFiles()) {
    writeEndpoint('diputados/diputados', diputados)
  }

  try {
    // Matching usa datos/v1/diputados/diputados (existente o recién escrito).
    if (shouldWriteJsonFiles()) {
      writeEndpoint('/diputados/diputados', diputados)
    }
    const viajes = await crawlViajes()
    console.log(
      `Viajes: ${viajes.nacionales.length} nacionales, `
      + `${viajes.internacionales.length} internacionales `
      + `(${viajes.recursos.length} CSVs nacionales)`,
    )
  }
  catch (e: any) {
    console.error('Viajes: no se pudo scrapear', e?.message || e)
  }

  try {
    const comisiones = await crawlComisiones()
    applyComisionesMetaToDiputados(diputados, comisiones)
    if (shouldWriteJsonFiles()) {
      writeEndpoint('diputados/diputados', diputados)
      writeEndpoint('/diputados/diputados', diputados)
    }
    console.log(`Comisiones: ${comisiones.length}`)
  }
  catch (e: any) {
    console.error('Comisiones: no se pudo scrapear', e?.message || e)
  }

  try {
    const periodos = await crawlPeriodos()
    console.log(`Periodos: ${periodos.periodos.length} parlamentarios`)
  }
  catch (e: any) {
    console.error('Periodos: no se pudo scrapear', e?.message || e)
  }

  const TURSO_DATABASE_URL = process.env.VITE_TURSO_DATABASE_URL
  const TURSO_AUTH_TOKEN = process.env.VITE_TURSO_AUTH_TOKEN

  if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && shouldWriteFromDatabase()) {
    const db = new DiputadosDatabaseService(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

    try {
      await db.initialize()

      const timestamp = new Date().toISOString()

      const itemsToInsert = diputados.map(diputado => ({
        diputado,
        timestamp,
      }))

      await db.insertBatchDiputados(itemsToInsert)

      await generateEndpointEstatico(db)
    }
    finally {
      db.close()
    }
  }

  return diputados
}

/** Clave estable de mandato: mismo id + mismo inicio de periodoMandato. */
function mandatoKey(d: Diputado): string {
  return `${d.id}|${d.periodoMandato?.inicio || ''}`
}

function bloqueInicioMs(d: Diputado): number {
  return new Date(d.periodoBloque?.inicio || 0).getTime()
}

function uniqueByMandato(rows: Diputado[]): Diputado[] {
  const byKey = new Map<string, Diputado>()
  for (const row of rows) {
    if (!row?.id || !row.periodoMandato?.inicio) continue
    const key = mandatoKey(row)
    const prev = byKey.get(key)
    if (!prev || bloqueInicioMs(row) >= bloqueInicioMs(prev)) {
      byKey.set(key, row)
    }
  }
  return Array.from(byKey.values())
}

async function generateEndpointEstatico(db: DiputadosDatabaseService) {
  const todosLosDatos = await db.getAllDiputados()

  writeEndpoint('diputados/diputados', todosLosDatos)
}

/**
 * El dataset publica CSV/JSON. Desde ~2025 los CSV “actuales” perdieron la
 * columna ID (8 cols). El histórico con ID sigue en el JSON de
 * “Composición Actual…”. Preferimos ese schema; si no hay, parseamos el
 * CSV nuevo y reusamos IDs del endpoint local por nombre+distrito.
 */
async function fetchLegisladores(): Promise<Diputado[]> {
  const downloadUrls = await listLegisladoresDownloadUrls()
  const tried: string[] = []

  for (const url of downloadUrls) {
    tried.push(url)
    try {
      if (/\.json(?:$|\?)/i.test(url)) {
        const rows = parseHistorialJson(await getJson(url))
        if (rows.length) return rows
        continue
      }

      const csv = await getCsv(url)
      if (hasHistorialCsvSchema(csv)) {
        const rows = parseHistorialCsv(csv)
        if (rows.length) return rows
      }
      if (hasActualCsvSchema(csv)) {
        const rows = parseActualCsv(csv)
        if (rows.length) return rows
      }
    }
    catch (error) {
      console.warn('No se pudo leer recurso de legisladores', { url, error })
    }
  }

  throw new Error(
    `No se encontró un recurso de legisladores usable (histórico con ID o CSV actual). Intentados: ${tried.join(', ') || 'ninguno'}`,
  )
}

async function listLegisladoresDownloadUrls(): Promise<string[]> {
  const fromCkan = await listDownloadUrlsFromCkan()
  if (fromCkan.length) {
    return preferHistorialUrls(fromCkan)
  }

  const fromHtml = await listDownloadUrlsFromHtml(`${BASE_URL}/dataset/${DATASET_SLUG}`)
  return preferHistorialUrls(fromHtml)
}

/**
 * Preferir JSON/CSV históricos (con ID) antes que los CSV actuales de 8 cols.
 */
function preferHistorialUrls(urls: string[]): string[] {
  const score = (url: string) => {
    const u = url.toLowerCase()
    if (u.includes('acual') || u.includes('actual')) return 0
    if (u.endsWith('.json') || u.includes('.json')) return 1
    if (u.includes('hist')) return 2
    return 3
  }
  return [...urls].sort((a, b) => score(a) - score(b))
}

async function listDownloadUrlsFromCkan(): Promise<string[]> {
  try {
    const response = await axios.get(CKAN_PACKAGE_SHOW, {
      params: { id: DATASET_SLUG },
      timeout: 30_000,
      headers: { 'User-Agent': USER_AGENT },
    })
    const resources = response.data?.result?.resources
    if (!Array.isArray(resources)) return []

    return resources
      .map((r: { url?: string, format?: string }) => String(r?.url || '').trim())
      .filter((url: string) => /\.(csv|json)(?:$|\?)/i.test(url))
      .map((url: string) => url.replace(/^http:\/\//i, 'https://'))
  }
  catch (error) {
    console.warn('CKAN package_show falló; se usa scrape HTML', { error })
    return []
  }
}

async function listDownloadUrlsFromHtml(datasetUrl: string): Promise<string[]> {
  const response = await fetch(datasetUrl)
  const html = await response.text()
  const $ = cheerio.load(html)

  const resourceUrls = $('a.heading')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter((href): href is string => Boolean(href))
    .map(href => href.startsWith('http') ? href : `${BASE_URL}${href}`)

  const downloads: string[] = []
  for (const resourceUrl of resourceUrls) {
    const fileUrl = await parseResourceDownloadUrl(resourceUrl)
    if (fileUrl) downloads.push(fileUrl)
  }
  return downloads
}

async function parseResourceDownloadUrl(resourceUrl: string): Promise<string | null> {
  const response = await fetch(resourceUrl)
  const html = await response.text()
  const $ = cheerio.load(html)

  return $('a[href$=".json"]').attr('href')
    || $('a[href$=".csv"]').attr('href')
    || null
}

async function getCsv(url: string): Promise<string> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    headers: { 'User-Agent': USER_AGENT },
  })

  const buffer = Buffer.from(response.data)

  // Los CSV nuevos vienen en UTF-8; el histórico a veces en latin1.
  const asUtf8 = buffer.toString('utf8')
  if (!asUtf8.includes('\uFFFD') && /ID|APELLIDO/i.test(asUtf8.slice(0, 200))) {
    return asUtf8
  }

  return iconv.decode(buffer, 'latin1')
}

async function getJson(url: string): Promise<unknown> {
  const response = await axios.get(url, {
    timeout: 60_000,
    headers: { 'User-Agent': USER_AGENT },
  })
  return response.data
}

function splitCsvHeader(csv: string): string[] {
  const header = csv.split(/\r?\n/, 1)[0] || ''
  return header
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map(field => field.trim().replace(/^"|"$/g, '').toUpperCase())
}

function hasHistorialCsvSchema(csv: string): boolean {
  const fields = splitCsvHeader(csv)
  return fields.length === 12 && fields[0] === 'ID'
}

function hasActualCsvSchema(csv: string): boolean {
  const fields = splitCsvHeader(csv)
  return fields.includes('APELLIDO')
    && fields.includes('NOMBRE')
    && fields.includes('MANDATO')
    && !fields.includes('ID')
}

function parseHistorialJson(data: unknown): Diputado[] {
  if (!Array.isArray(data) || !data.length) return []
  const sample = data[0]
  if (!sample || typeof sample !== 'object' || !('ID' in sample)) return []

  return data
    .map((row: any) => {
      const id = String(row.ID || '').trim()
      if (!id) return null

      return {
        id,
        nombre: parseNombreApellido(String(row.NOMBRE || '')),
        apellido: parseNombreApellido(String(row.APELLIDO || '')),
        genero: String(row.GENERO || row.SEXO || '').trim(),
        provincia: titleCaseSpanish(String(row.DISTRITO || '').toLowerCase()),
        periodoMandato: parsePeriodo(String(row.INICIO || ''), String(row.FIN || '')),
        juramentoFecha: parseFecha(String(row.JURAMENTO || '')),
        ceseFecha: parseFecha(String(row.CESE || '')),
        bloque: titleCaseSpanish(String(row.BLOQUE || '').toLowerCase()),
        periodoBloque: parsePeriodo(
          String(row.BLOQUE_INICIO || ''),
          String(row.BLOQUE_FIN || ''),
        ),
        foto: getFoto(id),
      } as Diputado
    })
    .filter((diputado): diputado is Diputado =>
      Boolean(diputado && diputado.periodoMandato.inicio),
    )
}

function parseHistorialCsv(csv: string): Diputado[] {
  const lines = csv.split(/\r?\n/)

  return lines
    .slice(1)
    .map((line) => {
      const fields = line
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map(field => field.trim().replace(/^"|"$/g, ''))

      if (fields.length !== 12) {
        if (line.trim()) {
          console.warn('Invalid historial line', { line, fields })
        }
        return null
      }

      const [
        id,
        apellido,
        nombre,
        genero,
        provincia,
        inicioMandato,
        finMandato,
        juramentoFecha,
        ceseFecha,
        bloque,
        bloqueInicio,
        bloqueFin,
      ] = fields

      return {
        id,
        nombre: parseNombreApellido(nombre),
        apellido: parseNombreApellido(apellido),
        genero,
        provincia: titleCaseSpanish(provincia.toLowerCase()),
        periodoMandato: parsePeriodo(inicioMandato, finMandato),
        juramentoFecha: parseFecha(juramentoFecha),
        ceseFecha: parseFecha(ceseFecha),
        bloque: titleCaseSpanish(bloque.toLowerCase()),
        periodoBloque: parsePeriodo(bloqueInicio, bloqueFin),
        foto: getFoto(id),
      } as Diputado
    })
    .filter((diputado): diputado is Diputado =>
      Boolean(diputado && diputado.periodoMandato.inicio),
    )
}

/**
 * Schema nuevo (sin ID): APELLIDO,NOMBRE,SEXO,DISTRITO,MANDATO,FECHA_DE_JURA,FECHA_DE_INICIO,BLOQUE
 * MANDATO = "2023-2027". Fechas = dd/MM/yyyy.
 */
function parseActualCsv(csv: string): Diputado[] {
  const lines = csv.split(/\r?\n/)
  const idIndex = buildExistingIdIndex()

  return lines
    .slice(1)
    .map((line) => {
      const fields = line
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map(field => field.trim().replace(/^"|"$/g, ''))

      if (fields.length < 8) {
        if (line.trim()) {
          console.warn('Invalid actual line', { line, fields })
        }
        return null
      }

      const [
        apellidoRaw,
        nombreRaw,
        genero,
        provinciaRaw,
        mandato,
        juramentoRaw,
        inicioRaw,
        bloqueRaw,
      ] = fields

      const apellido = parseNombreApellido(apellidoRaw)
      const nombre = parseNombreApellido(nombreRaw)
      const provincia = titleCaseSpanish(provinciaRaw.toLowerCase())
      const { inicio, fin } = parseMandatoRange(mandato, inicioRaw)
      if (!inicio) return null

      const id = resolveId(idIndex, apellido, nombre, provincia)
        || synthesizeId(apellido, nombre, provincia, inicio)

      return {
        id,
        nombre,
        apellido,
        genero,
        provincia,
        periodoMandato: { inicio, fin },
        juramentoFecha: parseFecha(juramentoRaw),
        ceseFecha: fin,
        bloque: titleCaseSpanish(bloqueRaw.toLowerCase()),
        periodoBloque: { inicio, fin },
        foto: getFoto(id),
      } as Diputado
    })
    .filter((diputado): diputado is Diputado => Boolean(diputado))
}

function buildExistingIdIndex(): Map<string, string> {
  const index = new Map<string, string>()
  for (const d of currentValues) {
    const key = personKey(d.apellido, d.nombre, d.provincia)
    if (key && d.id && !index.has(key)) {
      index.set(key, d.id)
    }
  }
  return index
}

function resolveId(
  index: Map<string, string>,
  apellido: string,
  nombre: string,
  provincia: string,
): string | null {
  return index.get(personKey(apellido, nombre, provincia)) || null
}

function personKey(apellido: string, nombre: string, provincia: string): string {
  return [apellido, nombre, provincia].map(normalizeKeyPart).join('|')
}

function normalizeKeyPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function synthesizeId(
  apellido: string,
  nombre: string,
  provincia: string,
  inicio: string,
): string {
  const base = personKey(apellido, nombre, provincia).slice(0, 40) || 'diputado'
  const year = (inicio.match(/\d{4}/) || ['0000'])[0]
  return `HCDN-GEN-${base}-${year}`
}

function parseMandatoRange(mandato: string, inicioRaw: string): {
  inicio: string | null
  fin: string | null
} {
  const inicioFromFecha = parseFecha(inicioRaw)
  const match = String(mandato || '').match(/(\d{4})\s*[-–]\s*(\d{4})/)
  if (!match) {
    return { inicio: inicioFromFecha, fin: null }
  }

  const startYear = Number(match[1])
  const endYear = Number(match[2])
  const inicio = inicioFromFecha
    || parseFecha(`${startYear}-12-10`)
  // El histórico HCDN usa fin = 09/12 del año final.
  const fin = parseFecha(`${endYear}-12-09`)

  return { inicio, fin }
}

function parseNombreApellido(texto: string) {
  return titleCaseSpanish(texto.toLowerCase()).replace(/"/g, '')
}

function parsePeriodo(inicio: string, fin: string) {
  return {
    inicio: parseFecha(inicio),
    fin: parseFecha(fin),
  }
}

function parseFecha(fecha: string): string | null {
  const value = fecha?.trim()
  if (!value || value.toUpperCase() === 'NA') {
    return null
  }

  try {
    // ISO (histórico): 2009-12-10T00:00:00 o con offset
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parsed = parseISO(value)
      if (isValid(parsed)) return formatISO(parsed)
    }

    // Actual CSV: dd/MM/yyyy
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
      const parsed = parse(value, 'dd/MM/yyyy', new Date())
      if (isValid(parsed)) return formatISO(parsed)
    }
  }
  catch (error) {
    console.warn('Invalid fecha', {
      fecha,
      error,
    })
    return null
  }

  console.warn('Invalid fecha', { fecha })
  return null
}

function getFoto(id: string): string | undefined | null {
  return currentValues.find(diputado => diputado.id === id && diputado.foto)?.foto
}

async function enhanceWithPhoto(diputado: Diputado): Promise<Diputado> {
  const fotoFromCurrentValues = diputado.foto

  if (fotoFromCurrentValues?.startsWith('https://votaciones.hcdn.gob.ar/assets/diputados/')) {
    const path = `/diputados/diputados/${diputado.id}.jpg`

    if (!readStaticBuffer(path)) {
      try {
        await saveFoto(path, fotoFromCurrentValues)
      }
      catch {
        return diputado
      }
    }

    const foto = getStaticPublicUrl(path)

    return {
      ...diputado,
      foto,
    }
  }

  return diputado
}

async function saveFoto(path: string, foto: string) {
  let response
  let attempts = 0
  while (attempts < 3) {
    try {
      response = await axios.get(foto, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': USER_AGENT,
        },
      })
      break
    }
    catch (error) {
      console.error('Error fetching photo', {
        path,
        foto,
        error,
      })
      attempts++
    }
  }

  if (!response) {
    throw new Error('Error fetching photo')
  }

  writeStaticBuffer(path, response.data)
}
