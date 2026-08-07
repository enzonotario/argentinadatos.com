import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { getStaticPath } from '@argentinadatos/core/src/utils/getStaticPath.ts'
import { readStaticBuffer } from '@argentinadatos/core/src/utils/readStaticBuffer.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { PdfDataParser } from 'pdf-data-parser'
import {
  matchDietaRowToSenadorNombre,
} from './scrapeDietasMecanismos.ts'

export const VIAJES_INDEX_URL = 'https://www.senado.gob.ar/administrativo/viajes'
export const VIAJES_ENDPOINT = '/senado/viajes'
export const VIAJES_ORIGIN = 'https://www.senado.gob.ar'

const DOWNLOAD_CONCURRENCY = 6

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
}

export interface ViajeDocumento {
  id: string
  ambito: 'nacional' | 'internacional'
  anio: number
  /** Solo nacionales (mensuales). Internacionales suelen ser anuales. */
  mes: number | null
  mesNombre: string | null
  url: string
}

export interface ViajeNacional {
  ambito: 'nacional'
  anio: number
  mes: number
  mesNombre: string
  documentoId: string
  documentoUrl: string
  nombre: string
  senadorId: string | null
  origen: string
  origenCodigo: string | null
  destino: string
  destinoCodigo: string | null
}

export interface ViajeInternacional {
  ambito: 'internacional'
  anio: number
  mes: number | null
  mesNombre: string | null
  documentoId: string
  documentoUrl: string
  nombre: string
  senadorId: string | null
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
  documentos: ViajeDocumento[]
  nacionales: ViajeNacional[]
  internacionales: ViajeInternacional[]
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

function mesNumero(nombre: string | null | undefined): number | null {
  if (!nombre) {
    return null
  }
  const key = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
  return MESES[key] || null
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

export function parseLugar(raw: string): { nombre: string, codigo: string | null } {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  const withParen = text.match(/^(.*?)\s*\(([A-Za-z]{3})\)\s*$/)
  if (withParen) {
    return {
      nombre: titleCaseSpanish(withParen[1].trim().toLowerCase()),
      codigo: withParen[2].toUpperCase(),
    }
  }
  const glued = text.match(/^(.*?)([A-Z]{3})\s*$/)
  if (glued && /[a-zA-ZáéíóúÁÉÍÓÚ]/.test(glued[1])) {
    // p.ej. BarilocheBRC — raro; preferir solo si hay paréntesis faltantes tipo Bariloche(BRC) ya cubierto
  }
  const noSpace = text.match(/^(.*?)\(([A-Za-z]{3})\)$/)
  if (noSpace) {
    return {
      nombre: titleCaseSpanish(noSpace[1].trim().toLowerCase()),
      codigo: noSpace[2].toUpperCase(),
    }
  }
  return {
    nombre: titleCaseSpanish(text.toLowerCase()),
    codigo: null,
  }
}

export function collectViajeDocumentos(html: string): ViajeDocumento[] {
  const $ = cheerio.load(html)
  const docs: ViajeDocumento[] = []

  const parseTab = (tabId: string, ambito: 'nacional' | 'internacional') => {
    const tab = $(`#${tabId}`)
    tab.find('.accordionv-group').each((_, group) => {
      const $group = $(group)
      const title = $group.find('.accordion-toggle').first().text().replace(/\s+/g, ' ').trim()
      const yearMatch = title.match(/20\d{2}/)
      const anio = yearMatch ? Number(yearMatch[0]) : null
      if (!anio) {
        return
      }

      $group.find('.accordion-inner .item').each((__, item) => {
        const $item = $(item)
        const href = $item.find('a[href*="verVuelo"]').attr('href') || ''
        const idMatch = href.match(/verVuelo\/(\d+)/)
        if (!idMatch) {
          return
        }
        const mesRaw = $item.find('p').first().text().replace(/\s+/g, ' ').trim()
        const mes = ambito === 'nacional' ? mesNumero(mesRaw) : null
        if (ambito === 'nacional' && !mes) {
          return
        }

        docs.push({
          id: idMatch[1],
          ambito,
          anio,
          mes,
          mesNombre: ambito === 'nacional' && mes ? mesNombreFromNumero(mes) : null,
          url: href.startsWith('http') ? href : `${VIAJES_ORIGIN}${href}`,
        })
      })
    })
  }

  parseTab('1E', 'nacional')
  parseTab('1F', 'internacional')
  return docs
}

export async function downloadViajesIndex(): Promise<ViajeDocumento[]> {
  const response = await fetch(VIAJES_INDEX_URL)
  if (!response.ok) {
    throw new Error(`Viajes index: HTTP ${response.status}`)
  }
  return collectViajeDocumentos(await response.text())
}

function pdfStaticPath(doc: ViajeDocumento): string {
  return `/senado/viajes/${doc.ambito}/${doc.id}.pdf`
}

export async function ensureViajePdf(
  doc: ViajeDocumento,
  options: { force?: boolean } = {},
): Promise<string> {
  const relative = pdfStaticPath(doc)
  if (!options.force) {
    const existing = readStaticBuffer(relative)
    if (existing && existing.subarray(0, 4).toString() === '%PDF') {
      return getStaticPath(relative)
    }
  }

  const response = await axios.get(doc.url, {
    responseType: 'arraybuffer',
    headers: {
      Accept: 'application/pdf,*/*',
      'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaDatos/1.0)',
    },
    validateStatus: status => status >= 200 && status < 400,
  })

  const buffer = Buffer.from(response.data)
  if (buffer.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(`Viaje ${doc.id}: respuesta no es PDF`)
  }

  return writeStaticBuffer(relative, buffer)
}

async function extractPdfRows(pdfPath: string): Promise<string[][]> {
  const parser = new PdfDataParser({ url: pdfPath })
  const rows = await parser.parse()
  return (rows as any[][])
    .map(row => (Array.isArray(row) ? row.map(cell => String(cell ?? '').replace(/\s+/g, ' ').trim()) : []))
    .filter(row => row.some(cell => cell.length > 0))
}

export function parseNacionalPdfRows(
  rows: string[][],
  doc: ViajeDocumento,
): ViajeNacional[] {
  const viajes: ViajeNacional[] = []
  const mes = doc.mes
  if (!mes) {
    return viajes
  }

  for (const row of rows) {
    if (row.length < 3) {
      continue
    }
    const [nombreRaw, origenRaw, destinoRaw] = row
    if (/apellido/i.test(nombreRaw) || /origen/i.test(origenRaw)) {
      continue
    }
    if (/viajes nacionales/i.test(nombreRaw)) {
      continue
    }
    if (!nombreRaw.includes(',') && !/[a-záéíóúñ]/i.test(nombreRaw)) {
      continue
    }

    const origen = parseLugar(origenRaw)
    const destino = parseLugar(destinoRaw)
    viajes.push({
      ambito: 'nacional',
      anio: doc.anio,
      mes,
      mesNombre: doc.mesNombre || mesNombreFromNumero(mes),
      documentoId: doc.id,
      documentoUrl: doc.url,
      nombre: titleCaseSpanish(nombreRaw.toLowerCase()),
      senadorId: null,
      origen: origen.nombre,
      origenCodigo: origen.codigo,
      destino: destino.nombre,
      destinoCodigo: destino.codigo,
    })
  }

  return viajes
}

function isMesSolo(row: string[]): number | null {
  if (row.length !== 1) {
    return null
  }
  return mesNumero(row[0])
}

function isExpediente(value: string): boolean {
  const v = value.trim()
  return /^(HSN\s*)?\d+\s*\/\s*\d{4}$/i.test(v)
    || /^HSN\s+\d+\s*\/\s*\d{4}$/i.test(v)
    // Formato 2013-2014: "HSN 6548 2013"
    || /^HSN\s+\d+\s+\d{4}$/i.test(v)
}

function isFechaRango(value: string): boolean {
  return /\d{1,2}\/\d{1,2}\s+al\s+\d{1,2}\/\d{1,2}/i.test(value)
}

function isFechaCorta(value: string): boolean {
  return /^\d{1,2}-[A-Za-zÁÉÍÓÚáéíóúñÑ]{3}$/i.test(value.trim())
}

function parseSiNo(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (v === 'sí' || v === 'si') {
    return true
  }
  if (v === 'no') {
    return false
  }
  return null
}

function parseMoney(value: string): { usd?: number, euro?: number, ars?: number } | null {
  const raw = value.replace(/\s+/g, ' ').trim()
  if (!raw || raw === '-') {
    return null
  }
  if (!/\d/.test(raw)) {
    return null
  }
  // Evitar fechas / expedientes / texto con año (p.ej. "Expoliva 2025").
  if (isFechaRango(raw) || isFechaCorta(raw) || isExpediente(raw) || parseSiNo(raw) !== null) {
    return null
  }
  if (!/(USD|U\$S|US\$|\bUSS\b|EUR|€|\$)/i.test(raw) && !/^[\d.\s,]+$/.test(raw)) {
    return null
  }

  const normalized = raw
    .replace(/U\$S/gi, 'USD')
    .replace(/US\$/gi, 'USD')
    .replace(/\bUSS\b/gi, 'USD')

  const numMatch = normalized.match(/([\d.]+,\d{2}|[\d]+(?:[.,]\d+)?)/)
  if (!numMatch) {
    return null
  }
  const amount = Number(numMatch[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(amount)) {
    return null
  }

  if (/€|EUR/i.test(normalized)) {
    return { euro: amount }
  }
  if (/\$/i.test(normalized) && !/USD/i.test(normalized)) {
    return { ars: amount }
  }
  return { usd: amount }
}

function parseFechaRango(
  value: string,
  anio: number,
): { inicio: string | null, fin: string | null, texto: string } {
  const texto = value.replace(/\s+/g, ' ').trim()
  const m = texto.match(/(\d{1,2})\/(\d{1,2})\s+al\s+(\d{1,2})\/(\d{1,2})/i)
  if (!m) {
    return { inicio: null, fin: null, texto }
  }
  const toIso = (d: string, month: string) => {
    const dd = d.padStart(2, '0')
    const mm = month.padStart(2, '0')
    return `${anio}-${mm}-${dd}`
  }
  return {
    inicio: toIso(m[1], m[2]),
    fin: toIso(m[3], m[4]),
    texto,
  }
}

const MONTH_ABBR: Record<string, number> = {
  ene: 1,
  jan: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  dec: 12,
}

function parseFechaCorta(value: string, anio: number): string | null {
  const m = value.trim().match(/^(\d{1,2})-([A-Za-zÁÉÍÓÚáéíóúñÑ]{3})$/i)
  if (!m) {
    return null
  }
  const mon = MONTH_ABBR[m[2].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().slice(0, 3)]
  if (!mon) {
    return null
  }
  return `${anio}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

interface IntlDraft {
  mes: number | null
  mesNombre: string | null
  nombre: string
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
  cells: string[]
}

function emptyDraft(mes: number | null): IntlDraft {
  return {
    mes,
    mesNombre: mes ? mesNombreFromNumero(mes) : null,
    nombre: '',
    expediente: '',
    destino: '',
    fechaInicio: null,
    fechaFin: null,
    fechaTexto: null,
    asistenciaAlViajero: null,
    viaticos: null,
    viaticosUsd: null,
    viaticosEuro: null,
    viaticosArs: null,
    motivo: null,
    bloque: null,
    cells: [],
  }
}

function classifyIntlCells(draft: IntlDraft, cells: string[], anio: number): void {
  draft.cells.push(...cells)
  const pendingDates: string[] = []

  for (const cell of cells) {
    if (!cell || cell === '-') {
      continue
    }
    if (isExpediente(cell)) {
      if (!draft.expediente) {
        draft.expediente = cell.replace(/\s+/g, ' ').trim()
      }
      continue
    }
    if (isFechaRango(cell)) {
      const parsed = parseFechaRango(cell, anio)
      draft.fechaTexto = parsed.texto
      draft.fechaInicio = parsed.inicio
      draft.fechaFin = parsed.fin
      if (parsed.inicio) {
        draft.mes = Number(parsed.inicio.slice(5, 7))
        draft.mesNombre = mesNombreFromNumero(draft.mes)
      }
      continue
    }
    if (isFechaCorta(cell)) {
      pendingDates.push(cell)
      continue
    }
    const siNo = parseSiNo(cell)
    if (siNo !== null) {
      if (draft.asistenciaAlViajero === null) {
        draft.asistenciaAlViajero = siNo
      }
      else if (draft.viaticos === null) {
        draft.viaticos = siNo
      }
      continue
    }
    const money = parseMoney(cell)
    if (money) {
      if (money.usd != null) {
        draft.viaticosUsd = (draft.viaticosUsd || 0) + money.usd
      }
      if (money.euro != null) {
        draft.viaticosEuro = (draft.viaticosEuro || 0) + money.euro
      }
      if (money.ars != null) {
        draft.viaticosArs = (draft.viaticosArs || 0) + money.ars
      }
      continue
    }

    // Nombre: primera celda "humana" antes de expediente, o si aún vacío.
    if (!draft.nombre && /[a-záéíóúñ]/i.test(cell) && cell.length < 80) {
      draft.nombre = cell
      continue
    }

    // Destino suele ir antes de la fecha.
    if (!draft.fechaTexto && draft.fechaInicio == null && pendingDates.length === 0) {
      draft.destino = draft.destino ? `${draft.destino} ${cell}`.trim() : cell
      continue
    }

    // Tras fechas/si-no/montos: motivo o bloque.
    if (!draft.motivo) {
      draft.motivo = cell
      continue
    }

    // Continuaciones de motivo vs bloque final (bloques suelen ser cortos).
    if (
      !draft.bloque
      && cell.length <= 55
      && cell.split(/\s+/).length <= 5
      && !/[.!?]$/.test(cell)
      && !/conferencia|asamblea|reunion|reunión|foro|feria|cumbre|programa/i.test(cell)
    ) {
      draft.bloque = cell
      continue
    }
    draft.motivo = `${draft.motivo} ${cell}`.trim()
  }

  if (pendingDates.length >= 1) {
    draft.fechaInicio = parseFechaCorta(pendingDates[0], anio)
    draft.fechaFin = pendingDates[1]
      ? parseFechaCorta(pendingDates[1], anio)
      : draft.fechaInicio
    draft.fechaTexto = pendingDates.join(' / ')
    if (draft.fechaInicio) {
      draft.mes = Number(draft.fechaInicio.slice(5, 7))
      draft.mesNombre = mesNombreFromNumero(draft.mes)
    }
  }
}

function finalizeDraft(draft: IntlDraft, doc: ViajeDocumento): ViajeInternacional | null {
  if (!draft.nombre || !draft.expediente) {
    return null
  }
  return {
    ambito: 'internacional',
    anio: doc.anio,
    mes: draft.mes,
    mesNombre: draft.mesNombre,
    documentoId: doc.id,
    documentoUrl: doc.url,
    nombre: titleCaseSpanish(draft.nombre.toLowerCase()),
    senadorId: null,
    expediente: draft.expediente,
    destino: draft.destino ? titleCaseSpanish(draft.destino.toLowerCase()) : '',
    fechaInicio: draft.fechaInicio,
    fechaFin: draft.fechaFin,
    fechaTexto: draft.fechaTexto,
    asistenciaAlViajero: draft.asistenciaAlViajero,
    viaticos: draft.viaticos,
    viaticosUsd: draft.viaticosUsd,
    viaticosEuro: draft.viaticosEuro,
    viaticosArs: draft.viaticosArs,
    motivo: draft.motivo,
    bloque: draft.bloque ? titleCaseSpanish(draft.bloque.toLowerCase()) : null,
  }
}

export function parseInternacionalPdfRows(
  rows: string[][],
  doc: ViajeDocumento,
): ViajeInternacional[] {
  const viajes: ViajeInternacional[] = []
  let mesActual: number | null = null
  let draft: IntlDraft | null = null

  const flush = () => {
    if (!draft) {
      return
    }
    const item = finalizeDraft(draft, doc)
    if (item) {
      viajes.push(item)
    }
    draft = null
  }

  for (const row of rows) {
    if (row.some(c => /^autoridad$/i.test(c)) && row.some(c => /expediente/i.test(c))) {
      continue
    }
    if (row.length === 1 && /registro de viajes/i.test(row[0])) {
      continue
    }

    const mes = isMesSolo(row)
    if (mes) {
      flush()
      mesActual = mes
      continue
    }

    if (row.some(c => /no se registran viajes/i.test(c))) {
      continue
    }

    const expIndex = row.findIndex(isExpediente)
    if (expIndex >= 0) {
      flush()
      draft = emptyDraft(mesActual)
      const nombreCells = row.slice(0, expIndex)
      draft.nombre = nombreCells.join(' ').trim()
      classifyIntlCells(draft, row.slice(expIndex), doc.anio)
      continue
    }

    if (draft) {
      // Continuaciones típicas: [resto motivo, bloque] o destino/fecha partidos.
      if (
        row.length === 2
        && !draft.bloque
        && draft.motivo
        && !isFechaRango(row[0])
        && !isFechaCorta(row[0])
        && parseSiNo(row[0]) === null
      ) {
        draft.motivo = `${draft.motivo} ${row[0]}`.trim()
        draft.bloque = row[1]
        continue
      }
      classifyIntlCells(draft, row, doc.anio)
    }
  }

  flush()
  return viajes
}

export function matchViajesSenadorIds<T extends { nombre: string, senadorId: string | null }>(
  viajes: T[],
  senadores: Array<{ id: string, nombre: string }>,
): T[] {
  for (const viaje of viajes) {
    const hits = senadores.filter(s => matchDietaRowToSenadorNombre(viaje.nombre, s.nombre))
    const uniqueIds = [...new Set(hits.map(h => String(h.id)))]
    viaje.senadorId = uniqueIds.length === 1 ? uniqueIds[0] : null
  }
  return viajes
}

export async function crawlViajes(options: { force?: boolean } = {}): Promise<ViajesData> {
  const documentos = await downloadViajesIndex()
  if (documentos.length === 0) {
    throw new Error('Viajes: no se encontraron documentos en el índice')
  }

  const nacionales: ViajeNacional[] = []
  const internacionales: ViajeInternacional[] = []

  await mapPool(documentos, DOWNLOAD_CONCURRENCY, async (doc) => {
    try {
      const pdfPath = await ensureViajePdf(doc, { force: options.force })
      const rows = await extractPdfRows(pdfPath)
      if (doc.ambito === 'nacional') {
        nacionales.push(...parseNacionalPdfRows(rows, doc))
      }
      else {
        internacionales.push(...parseInternacionalPdfRows(rows, doc))
      }
    }
    catch (e: any) {
      console.error(`Viajes: error en documento ${doc.ambito}/${doc.id}:`, e?.message || e)
    }
  })

  nacionales.sort((a, b) => a.anio - b.anio || a.mes - b.mes || a.nombre.localeCompare(b.nombre))
  internacionales.sort((a, b) => a.anio - b.anio || (a.mes || 0) - (b.mes || 0) || a.nombre.localeCompare(b.nombre))

  const senadores = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Array<{
    id: string
    nombre: string
  }>
  if (senadores.length > 0) {
    matchViajesSenadorIds(nacionales, senadores)
    matchViajesSenadorIds(internacionales, senadores)
  }

  const data: ViajesData = {
    fuente: VIAJES_INDEX_URL,
    actualizado: new Date().toISOString(),
    documentos: documentos.sort((a, b) => a.ambito.localeCompare(b.ambito) || a.anio - b.anio || (a.mes || 0) - (b.mes || 0)),
    nacionales,
    internacionales,
  }

  writeEndpoint(VIAJES_ENDPOINT, data)
  return data
}
