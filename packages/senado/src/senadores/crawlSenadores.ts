import fs from 'node:fs'
import { getStaticPublicUrl } from '@argentinadatos/core/src/utils/getStaticPublicUrl.ts'
import { getStaticPath } from '@argentinadatos/core/src/utils/getStaticPath.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'
import { shouldWriteJsonFiles, shouldWriteFromDatabase } from '@argentinadatos/core/src/utils/database-mode.ts'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { format, parse } from 'date-fns'
import { SenadoresDatabaseService } from './database/service.ts'
import {
  applyBloquesToSenadores,
  downloadSenadoresVigentes,
} from './applyBloques.ts'
import {
  applyComisionesMetaToSenadores,
  crawlComisiones,
} from './crawlComisiones.ts'
import { crawlViajes } from './crawlViajes.ts'
import {
  applyDietasMecanismosMeta,
  scrapeDietasMecanismos,
  type SenadorDietaMeta,
} from './scrapeDietasMecanismos.ts'
import type { SenadorComisionMeta } from './crawlComisiones.ts'

export interface Senador {
  id: string
  nombre: string
  provincia: string
  partido: string
  /** Bloque parlamentario actual (oficial, vigentes). */
  bloque: string | null
  periodoLegal: {
    inicio: string | null
    fin: string | null
  }
  periodoReal: {
    inicio: string | null
    fin: string | null
  }
  reemplazo: string | null
  observaciones: string | null
  foto: string | null
  email: string | null
  telefono: string | null
  redes: string[] | null
  meta: {
    dieta?: SenadorDietaMeta
    comisiones?: SenadorComisionMeta[]
  } | null
}

const JSON_URL
  = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoSenadoresHistorico/json'

const WEB_URL = 'https://www.senado.gob.ar/senadores/listados/listaSenadoRes'

const SENADO_ORIGIN = 'https://www.senado.gob.ar'

const DEFAULT_FOTO_PATH = (id: string) =>
  `/bundles/senadosenadores/images/fsena/${id}.gif`

/** Evita martillar el Senado con cientos de GETs en paralelo. */
const FOTO_DOWNLOAD_CONCURRENCY = 8

export async function crawlSenadores(): Promise<Senador[]> {
  await processJson()

  await processWeb()

  await processBloques()

  await processDietasMecanismos()

  await processComisiones()

  await processViajes()

  return JSON.parse(readEndpoint('/senado/senadores') || '[]')
}

async function processJson() {
  const currentValues = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Senador[]
  const fotosPorId = new Map<string, string>()
  for (const s of currentValues) {
    if (s.id && s.foto && !fotosPorId.has(String(s.id))) {
      fotosPorId.set(String(s.id), s.foto)
    }
  }

  const json = await downloadJson()
  const senadores = json.map(parseSenador)

  // Una sola descarga por id (el histórico repite el mismo ID en varios mandatos).
  const ids = [...new Set(senadores.map(s => String(s.id)))]
  await mapPool(ids, FOTO_DOWNLOAD_CONCURRENCY, async (id) => {
    if (fotosPorId.has(id)) {
      return
    }
    const foto = await ensureSenadorFoto(id)
    if (foto) {
      fotosPorId.set(id, foto)
    }
  })

  const senadoresConFotos = senadores.map((senador: Senador) => ({
    ...senador,
    foto: fotosPorId.get(String(senador.id)) || null,
  }))

  if (shouldWriteJsonFiles()) {
    writeEndpoint('/senado/senadores', senadoresConFotos)
  }

  const TURSO_DATABASE_URL = process.env.VITE_TURSO_DATABASE_URL
  const TURSO_AUTH_TOKEN = process.env.VITE_TURSO_AUTH_TOKEN

  if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && shouldWriteFromDatabase()) {
    const db = new SenadoresDatabaseService(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

    try {
      await db.initialize()

      const timestamp = new Date().toISOString()

      const itemsToInsert = senadoresConFotos.map(senador => ({
        senador,
        timestamp,
      }))

      await db.insertBatchSenadores(itemsToInsert)

      await generateEndpointEstatico(db)
    }
    finally {
      db.close()
    }
  }

  return senadoresConFotos
}

async function downloadJson() {
  const response = await fetch(JSON_URL)
  return (await response.json())?.table?.rows
}

function parseSenador(json: any): Senador {
  return {
    id: String(json.ID),
    nombre: titleCaseSpanish(json.SENADOR.toLowerCase()),
    provincia: titleCaseSpanish(json.PROVINCIA.toLowerCase()),
    partido: titleCaseSpanish(json['PARTIDO POLITICO O ALIANZA'].toLowerCase()),
    bloque: null,
    periodoLegal: parsePeriodo(
      json['INICIO PERIODO LEGAL'],
      json['CESE PERIODO LEGAL'],
    ),
    periodoReal: parsePeriodo(
      json['INICIO PERIODO REAL'],
      json['CESE PERIODO REAL'],
    ),
    reemplazo: json.REEMPLAZO
      ? titleCaseSpanish(json.REEMPLAZO.trim().toLowerCase())
      : null,
    observaciones: (json.OBSERVACIONES || '').trim() || null,
    foto: null,
    email: null,
    telefono: null,
    redes: null,
    meta: null,
  }
}

function parsePeriodo(inicio: string, fin: string) {
  return {
    inicio: parseFecha(inicio),
    fin: parseFecha(fin),
  }
}

function parseFecha(fecha: string) {
  try {
    return format(parse(fecha, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd')
  }
  catch {
    return null
  }
}

function extractSenadorIdFromHref(href: string | undefined): string | null {
  if (!href) {
    return null
  }
  const match = href.match(/\/senadores\/senador\/(\d+)/)
  return match?.[1] ?? null
}

function nombresIguales(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, ' ').toLowerCase()
    === b.trim().replace(/\s+/g, ' ').toLowerCase()
}

function resolveSenadoAssetUrl(src: string | undefined, id: string): string {
  const fallback = `${SENADO_ORIGIN}${DEFAULT_FOTO_PATH(id)}`
  if (!src) {
    return fallback
  }
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  if (src.startsWith('//')) {
    return `https:${src}`
  }
  if (src.startsWith('/')) {
    return `${SENADO_ORIGIN}${src}`
  }
  return fallback
}

function extensionFromUrl(url: string, id: string): string {
  const pathPart = url.split('?')[0] || ''
  const match = pathPart.match(/\.([a-zA-Z0-9]+)$/)
  if (match) {
    return match[1].toLowerCase()
  }
  return 'gif'
}

function isImageBuffer(data: Buffer): boolean {
  if (data.length < 4) {
    return false
  }
  // GIF
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return true
  }
  // JPEG
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return true
  }
  // PNG
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return true
  }
  // WEBP (RIFF....WEBP)
  if (
    data.length >= 12
    && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return true
  }
  return false
}

function localFotoPublicUrl(id: string, ext = 'gif'): string | null {
  const relative = `/senado/senadores/${id}.${ext}`
  const filePath = getStaticPath(relative)
  if (fs.existsSync(filePath)) {
    return getStaticPublicUrl(filePath)
  }
  // Recuperar si quedó guardado con otra extensión
  for (const other of ['gif', 'jpg', 'jpeg', 'png', 'webp']) {
    if (other === ext) {
      continue
    }
    const alt = getStaticPath(`/senado/senadores/${id}.${other}`)
    if (fs.existsSync(alt)) {
      return getStaticPublicUrl(alt)
    }
  }
  return null
}

/**
 * Asegura foto en static/ y devuelve URL pública.
 * Reusa archivo local si ya existe (aunque el JSON tenga foto null).
 */
export async function ensureSenadorFoto(
  id: string,
  srcFromWeb?: string | null,
): Promise<string | null> {
  const existing = localFotoPublicUrl(id)
  if (existing) {
    return existing
  }

  const url = resolveSenadoAssetUrl(srcFromWeb || undefined, id)
  const ext = extensionFromUrl(url, id)

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaDatosBot/1.0)',
        Accept: 'image/*,*/*',
      },
      validateStatus: status => status >= 200 && status < 300,
    })

    const dataBuffer = Buffer.from(response.data)
    if (!isImageBuffer(dataBuffer)) {
      console.error(`Foto de senador ${id} no es imagen válida (${url})`)
      return null
    }

    const path = writeStaticBuffer(
      `/senado/senadores/${id}.${ext}`,
      dataBuffer,
    )
    return getStaticPublicUrl(path)
  }
  catch (e: any) {
    console.error(`No se pudo descargar foto senador ${id} desde ${url}:`, e?.message || e)
    return null
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]
      await worker(current)
    }
  })
  await Promise.all(runners)
}

async function processWeb(): Promise<Senador[]> {
  const senadores = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Senador[]

  const response = await fetch(WEB_URL)

  const html = await response.text()

  const $ = cheerio.load(html)

  const fotosPendientes = new Map<string, string | undefined>()

  $('tr').each((_, el) => {
    const $el = $(el)
    const id = extractSenadorIdFromHref(
      $el.find('a[href*="/senadores/senador/"]').first().attr('href'),
    )
    const nombre = $el.find('a').eq(1).text().trim().replace(/\s+/g, ' ')
    const provincia = $el.find('td').eq(2).text().trim()
    const partido = $el.find('td').eq(3).text().trim()
    const email = $el.find('li').eq(0).text().trim()
    const telefono = $el.find('li').eq(1).text().trim()
    const fotoSrc = $el.find('img.lazy, td img').first().attr('src')
      || $el.find('img').first().attr('src')
    const redes = [
      ...$el.find('li').map((_, item) => {
        return String($(item).find('a').attr('href'))
          .trim()
          .replace(/^mailto:/, '')
      }),
    ]
      .filter(Boolean)
      .filter(red => red !== 'undefined')

    if (!id && !nombre) {
      return
    }

    const matches = id
      ? senadores.filter(s => String(s.id) === id)
      : senadores.filter(s => nombresIguales(s.nombre, nombre))

    if (matches.length === 0) {
      return
    }

    if (id) {
      fotosPendientes.set(id, fotoSrc || undefined)
    }

    for (const existingSenador of matches) {
      if (provincia) {
        existingSenador.provincia = provincia
      }
      if (partido) {
        existingSenador.partido = partido
      }
      existingSenador.email = email || existingSenador.email
      existingSenador.telefono = telefono || existingSenador.telefono
      existingSenador.redes = redes.length > 0 ? redes : existingSenador.redes
    }
  })

  // Completar fotos faltantes de los vigentes (HTML es la fuente de verdad del path).
  const idsSinFoto = [...fotosPendientes.keys()].filter((id) => {
    return senadores.some(s => String(s.id) === id && !s.foto)
  })

  await mapPool(idsSinFoto, FOTO_DOWNLOAD_CONCURRENCY, async (id) => {
    const foto = await ensureSenadorFoto(id, fotosPendientes.get(id))
    if (!foto) {
      return
    }
    for (const s of senadores) {
      if (String(s.id) === id) {
        s.foto = foto
      }
    }
  })

  if (shouldWriteJsonFiles()) {
    writeEndpoint('/senado/senadores', senadores)
  }

  const TURSO_DATABASE_URL = process.env.VITE_TURSO_DATABASE_URL
  const TURSO_AUTH_TOKEN = process.env.VITE_TURSO_AUTH_TOKEN

  if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && shouldWriteFromDatabase()) {
    const db = new SenadoresDatabaseService(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

    try {
      await db.initialize()

      const timestamp = new Date().toISOString()

      const itemsToInsert = senadores.map(senador => ({
        senador,
        timestamp,
      }))

      await db.insertBatchSenadores(itemsToInsert)

      await generateEndpointEstatico(db)
    }
    finally {
      db.close()
    }
  }

  return senadores
}

async function persistSenadores(senadores: Senador[]): Promise<void> {
  if (shouldWriteJsonFiles()) {
    writeEndpoint('/senado/senadores', senadores)
  }

  const TURSO_DATABASE_URL = process.env.VITE_TURSO_DATABASE_URL
  const TURSO_AUTH_TOKEN = process.env.VITE_TURSO_AUTH_TOKEN

  if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && shouldWriteFromDatabase()) {
    const db = new SenadoresDatabaseService(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

    try {
      await db.initialize()

      const timestamp = new Date().toISOString()

      const itemsToInsert = senadores.map(senador => ({
        senador,
        timestamp,
      }))

      await db.insertBatchSenadores(itemsToInsert)

      await generateEndpointEstatico(db)
    }
    finally {
      db.close()
    }
  }
}

async function processBloques(): Promise<Senador[]> {
  const senadores = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Senador[]

  try {
    const vigentes = await downloadSenadoresVigentes()
    const { matchedIds } = applyBloquesToSenadores(senadores, vigentes)
    console.log(`Bloques: aplicados a ${matchedIds.length} senadores vigentes`)
  }
  catch (e: any) {
    console.error('Bloques: no se pudo aplicar', e?.message || e)
  }

  await persistSenadores(senadores)
  return senadores
}

async function processComisiones(): Promise<Senador[]> {
  const senadores = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Senador[]

  try {
    const comisiones = await crawlComisiones()
    applyComisionesMetaToSenadores(senadores, comisiones)
    console.log(`Comisiones: ${comisiones.length} scrapeadas`)
  }
  catch (e: any) {
    console.error('Comisiones: no se pudo scrapear', e?.message || e)
  }

  await persistSenadores(senadores)
  return senadores
}

async function processViajes(): Promise<void> {
  try {
    const viajes = await crawlViajes({ force: false })
    console.log(
      `Viajes: ${viajes.nacionales.length} nacionales, ${viajes.internacionales.length} internacionales`,
    )
  }
  catch (e: any) {
    console.error('Viajes: no se pudo scrapear', e?.message || e)
  }
}

async function processDietasMecanismos(): Promise<Senador[]> {
  const senadores = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Senador[]

  try {
    // Usa caché si existe; solo llama Firecrawl si no hay datos guardados
    // (o VITE_DIETAS_FORCE_FIRECRAWL=1).
    const cache = await scrapeDietasMecanismos({ force: false })
    const { unmatchedRows } = applyDietasMecanismosMeta(senadores, cache)

    if (unmatchedRows.length > 0) {
      console.warn(
        `Dietas/mecanismos: ${unmatchedRows.length} filas sin match`,
        unmatchedRows.slice(0, 10).map(r => r.nombre),
      )
    }
  }
  catch (e: any) {
    console.error('Dietas/mecanismos: no se pudo aplicar meta', e?.message || e)
  }

  await persistSenadores(senadores)
  return senadores
}

async function generateEndpointEstatico(db: SenadoresDatabaseService) {
  const todosLosDatos = await db.getAllSenadores()

  writeEndpoint('/senado/senadores', todosLosDatos)
}
