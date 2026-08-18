import https from 'node:https'
import fs from 'node:fs'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { getStaticPath } from '@argentinadatos/core/src/utils/getStaticPath.ts'
import { getStaticPublicUrl } from '@argentinadatos/core/src/utils/getStaticPublicUrl.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'
import { USER_AGENT } from '../../constants.ts'
import type { Diputado } from './crawlDiputados.ts'

export const NOMINA_HCDN_URL = 'https://www.hcdn.gob.ar/diputados/'

const DOWNLOAD_CONCURRENCY = 8
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

export interface NominaFotoRow {
  nombre: string
  slug: string | null
  provincia: string
  fotoUrl: string
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

function preferMediumFotoUrl(url: string): string {
  return url.replace(/_small(\.\w+)$/i, '_medium$1')
}

export function parseNominaHtml(html: string): NominaFotoRow[] {
  const $ = cheerio.load(html)
  const rows: NominaFotoRow[] = []

  $('#tablaDiputados tbody tr').each((_, el) => {
    const $el = $(el)
    const img = $el.find('img').first().attr('src') || ''
    const $link = $el.find('a[href*="/diputados/"]').first()
    const nombre = $link.text().replace(/\s+/g, ' ').trim()
    const href = $link.attr('href') || ''
    const slugMatch = href.match(/\/diputados\/([^/]+)\/?/)
    const provincia = $el.find('td').eq(2).text().replace(/\s+/g, ' ').trim()
    if (!nombre || !img) return
    if (!/^https?:\/\//i.test(img)) return
    if (img.includes('logo')) return
    rows.push({
      nombre,
      slug: slugMatch?.[1] || null,
      provincia,
      fotoUrl: preferMediumFotoUrl(img),
    })
  })

  return rows
}

type DiputadoMatch = {
  id: string
  nombre: string
  apellido: string
  provincia: string
  periodoMandato?: { inicio: string | null, fin: string | null }
}

function isMandatoVigente(d: DiputadoMatch, now = Date.now()): boolean {
  const fin = d.periodoMandato?.fin
  if (!fin) return true
  const t = Date.parse(fin)
  if (Number.isNaN(t)) return true
  return t >= now - 24 * 60 * 60 * 1000
}

function uniqueId(rows: DiputadoMatch[]): string | null {
  const ids = [...new Set(rows.map(d => String(d.id)))]
  return ids.length === 1 ? ids[0]! : null
}

export function matchNominaToDiputadoId(
  row: NominaFotoRow,
  diputados: DiputadoMatch[],
): string | null {
  const clave = claveApellidoNombre(row.nombre)
  if (!clave) return null

  const hits: DiputadoMatch[] = []
  for (const d of diputados) {
    const catalog = `${d.apellido}, ${d.nombre}`
    if (claveApellidoNombre(catalog) === clave) hits.push(d)
  }
  if (!hits.length) return null

  const byName = uniqueId(hits)
  if (byName) return byName

  const wantProv = fold(row.provincia)
  const byProv = hits.filter(d => fold(d.provincia) === wantProv)
  const fromProv = uniqueId(byProv)
  if (fromProv) return fromProv

  const vigentes = (byProv.length ? byProv : hits).filter(d => isMandatoVigente(d))
  return uniqueId(vigentes)
}

export function localDiputadoFotoUrl(id: string): string | null {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
    const relative = `/diputados/diputados/${id}.${ext}`
    if (fs.existsSync(getStaticPath(relative))) {
      return getStaticPublicUrl(relative)
    }
  }
  return null
}

function extensionFromUrlAndBuffer(url: string, data: Buffer): string {
  if (data[0] === 0x89 && data[1] === 0x50) return 'png'
  if (data[0] === 0xFF && data[1] === 0xD8) return 'jpg'
  if (data[0] === 0x47 && data[1] === 0x49) return 'gif'
  if (data.length >= 12 && data[8] === 0x57 && data[9] === 0x45) return 'webp'
  const match = url.match(/\.(\w+)(?:\?|$)/)
  const ext = (match?.[1] || 'jpg').toLowerCase()
  return ext === 'jpeg' ? 'jpg' : ext
}

function isImageBuffer(data: Buffer): boolean {
  if (data.length < 32) return false
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return true
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) return true
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return true
  if (
    data.length >= 12
    && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return true
  }
  return false
}

async function downloadFoto(url: string): Promise<Buffer | null> {
  const candidates = [url]
  if (/_medium(\.\w+)$/i.test(url)) {
    candidates.push(url.replace(/_medium(\.\w+)$/i, '_small$1'))
  }
  for (const candidate of candidates) {
    try {
      const response = await axios.get(candidate, {
        responseType: 'arraybuffer',
        timeout: 20_000,
        httpsAgent,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'image/*,*/*',
          Referer: NOMINA_HCDN_URL,
        },
        validateStatus: status => status >= 200 && status < 300,
      })
      const data = Buffer.from(response.data)
      if (isImageBuffer(data)) return data
    }
    catch {
      // probar siguiente tamaño
    }
  }
  return null
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

export async function scrapeNominaHcdn(): Promise<NominaFotoRow[]> {
  const response = await axios.get(NOMINA_HCDN_URL, {
    timeout: 30_000,
    httpsAgent,
    headers: { 'User-Agent': USER_AGENT },
  })
  return parseNominaHtml(String(response.data || ''))
}

/**
 * Completa `foto` faltante desde la nómina actual de hcdn.gob.ar/diputados/.
 * Reusa static/ si ya está en disco.
 */
export async function fillMissingFotosFromNomina(
  diputados: Diputado[],
): Promise<{ matched: number, downloaded: number, unmatched: number }> {
  const nomina = await scrapeNominaHcdn()
  if (!nomina.length) {
    console.warn('Nómina HCDN: no se encontraron filas con foto')
    return { matched: 0, downloaded: 0, unmatched: 0 }
  }

  const byId = new Map<string, Diputado[]>()
  for (const d of diputados) {
    const list = byId.get(String(d.id)) || []
    list.push(d)
    byId.set(String(d.id), list)
  }

  const catalog = diputados
  const jobs: Array<{ id: string, fotoUrl: string }> = []
  let unmatched = 0

  for (const row of nomina) {
    const id = matchNominaToDiputadoId(row, catalog)
    if (!id) {
      unmatched++
      continue
    }
    const rows = byId.get(id) || []
    const local = localDiputadoFotoUrl(id)
    if (local) {
      for (const d of rows) d.foto = local
      continue
    }
    const staticUrl = rows.find(d =>
      typeof d.foto === 'string'
      && d.foto.includes('/static/diputados/diputados/'),
    )?.foto
    if (staticUrl) {
      for (const d of rows) d.foto = staticUrl
      continue
    }
    jobs.push({ id, fotoUrl: row.fotoUrl })
  }

  let downloaded = 0
  const uniqueJobs = [...new Map(jobs.map(j => [j.id, j])).values()]
  await mapPool(uniqueJobs, DOWNLOAD_CONCURRENCY, async (job) => {
    const data = await downloadFoto(job.fotoUrl)
    if (!data) {
      console.warn(`Nómina HCDN: no se pudo bajar foto ${job.id}`)
      return
    }
    const ext = extensionFromUrlAndBuffer(job.fotoUrl, data)
    const path = `/diputados/diputados/${job.id}.${ext}`
    writeStaticBuffer(path, data)
    const publicUrl = getStaticPublicUrl(path)
    for (const d of byId.get(job.id) || []) d.foto = publicUrl
    downloaded++
  })

  const matched = nomina.length - unmatched
  console.log(
    `Nómina HCDN: ${nomina.length} vigentes, ${matched} matched, `
    + `${downloaded} fotos nuevas, ${unmatched} sin match`,
  )
  return { matched, downloaded, unmatched }
}
