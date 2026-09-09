import type { Collection } from 'collect.js'
import { shouldWriteFromDatabase, shouldWriteJsonFiles } from '@argentinadatos/core/src/utils/database-mode.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { collect } from 'collect.js'
import { getYear, parse } from 'date-fns'
import { USER_AGENT, VOTACIONES_BASE_URL } from '../../constants.ts'
import { ActasDatabaseService } from './database/service.ts'
import { parseCabeceraPdf } from './parseCabeceraPdf.ts'

enum TipoVoto {
  Afirmativo = 'afirmativo',
  Negativo = 'negativo',
  Abstencion = 'abstencion',
  Ausente = 'ausente',
  Presidente = 'presidente',
}

interface Voto {
  diputado: string
  tipoVoto: TipoVoto
  imagen: string
  videoDiscurso: string | null
}

interface Acta {
  id: string
  periodo: string
  reunion: string
  numeroActa: string
  titulo: string
  resultado: string
  fecha: Date
  presidente: string
  votosAfirmativos: number
  votosNegativos: number
  abstenciones: number
  ausentes: number
  votos: Voto[]
  /** Línea de sesión del PDF (p. ej. "144° - Período Ordinario - …"). */
  sesion?: string | null
  /** Nominal, etc. */
  votacion?: string | null
  /** "Más de la mitad — Votos Emitidos". */
  mayoria?: string | null
  baseMayoria?: string | null
  tipoMayoria?: string | null
  miembros?: number | null
  presentes?: number | null
  sinVotar?: number | null
  ultModVer?: string | null
}

const currentValues = JSON.parse(readEndpoint('diputados/actas') || '[]')

const diputados = JSON.parse(readEndpoint('diputados/diputados') || '[]')

export async function crawlActas(): Promise<Acta[]> {
  const currentIds = collect(currentValues).pluck('id').all() as string[]

  const votacionesUrls = await getVotacionesUrls(currentIds)

  // Concurrencia acotada: Promise.all masivo satura votaciones.hcdn.gob.ar → 403.
  const newValues = (
    await mapPool(votacionesUrls, HTML_CONCURRENCY, url => parseVotacionPage(url))
  ).filter(Boolean)

  // Save all actas.
  const actas = collect(newValues)
    .merge(
      currentValues.map((acta: Acta) => ({
        ...acta,
        fecha: new Date(acta.fecha),
      })),
    )
    // @ts-expect-error: TS can't infer the type of the collection
    .filter((acta: Acta) => acta.fecha instanceof Date)
    // Deduplicar por id (el dataset histórico tiene filas repetidas).
    // No usar periodo-reunion-numeroActa: colapsaba actas distintas y reescribía todo.
    .unique((acta: Acta) => String(acta.id))
    .sortBy('fecha')
    .all() as Acta[]

  // Backfill cabecera PDF (campos que el HTML no trae) en actas recientes.
  const toEnrich = [...actas]
    .filter(a => a.miembros == null || a.sesion == null)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .slice(0, 50)

  if (toEnrich.length) {
    console.log(`Cabeceras PDF: enriqueciendo ${toEnrich.length} actas…`)
    await mapPool(toEnrich, PDF_CONCURRENCY, async (acta) => {
      const cabecera = await parseCabeceraPdf(String(acta.id))
      if (!cabecera) return
      Object.assign(acta, applyCabeceraPdf(acta, cabecera))
    })
  }

  if (shouldWriteJsonFiles()) {
    writeEndpoint('diputados/actas', actas, { compact: true })

    collect(actas)
      .groupBy((acta: Acta) => getYear(acta.fecha))
      // @ts-expect-error: TS can't infer the type of the collection
      .map((actas: Collection<Acta>, year: number) => ({
        year,
        actas: actas
          .sortBy('fecha')
          .all(),
      }))
      .each(({ year, actas }) =>
        writeEndpoint(`diputados/actas/${year}`, actas, { compact: true }),
      )

    writeEndpoint('diputados/diputados', diputados)
  }

  const POCKETBASE_URL = process.env.POCKETBASE_URL
  const POCKETBASE_TOKEN = process.env.POCKETBASE_TOKEN

  if (POCKETBASE_TOKEN && shouldWriteFromDatabase()) {
    const db = new ActasDatabaseService(POCKETBASE_URL, POCKETBASE_TOKEN)

    try {
      await db.initialize()

      const timestamp = new Date().toISOString()

      const itemsToInsert = actas.map(acta => ({
        acta,
        año: getYear(acta.fecha),
        timestamp,
      }))

      await db.insertBatchActas(itemsToInsert)

      await generateEndpointEstatico(db, actas)
    }
    finally {
      db.close()
    }
  }

  return actas
}

async function generateEndpointEstatico(db: ActasDatabaseService, actas: Acta[]) {
  const todosLosDatos = await db.getAllActas()

  writeEndpoint('diputados/actas', todosLosDatos, { compact: true })

  const years = collect(actas)
    .groupBy((acta: Acta) => getYear(acta.fecha))
    .all()

  for (const [year, actasByYear] of Object.entries(years)) {
    const yearNum = Number(year)
    if (isNaN(yearNum) || !isFinite(yearNum)) {
      continue
    }
    const actasData = await db.getActasByAño(yearNum)
    writeEndpoint(`diputados/actas/${year}`, actasData, { compact: true })
  }
}

const HTML_CONCURRENCY = 6
const PDF_CONCURRENCY = 3
/** Sin ancla de home (captcha): no barrer cientos de IDs; alcanza para huecos recientes. */
const FORWARD_WITHOUT_HOME = 50
const FORWARD_WITH_HOME = 40
const BACKWARD_WITH_DATA = 10
const BACKWARD_WITHOUT_DATA = 20

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0

  async function run() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await worker(items[i]!, i)
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => run(),
  )
  await Promise.all(runners)
  return out
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: `${VOTACIONES_BASE_URL}/`,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        validateStatus: status => status < 500,
        timeout: 30_000,
      })

      if (response.status === 404 || response.status === 417) {
        const error: any = new Error(`HTTP ${response.status}`)
        error.response = response
        throw error
      }

      // 403 suele ser rate-limit: reintentar con backoff corto.
      if (response.status === 403) {
        if (i < retries - 1) {
          await sleep(500 * (i + 1))
          continue
        }
        const error: any = new Error(`HTTP ${response.status}`)
        error.response = response
        throw error
      }

      return response
    }
    catch (error: any) {
      const status = error?.response?.status
      if (status === 404 || status === 417 || i === retries - 1) {
        throw error
      }
      if (status === 403) {
        await sleep(500 * (i + 1))
        continue
      }
      await sleep(300 * (i + 1))
    }
  }
}

async function getVotacionesUrls(currentIds: string[]) {
  const maxKnownId = resolveMaxId(currentIds)
  const homeAnchorId = await resolveAnchorIdFromHome()

  // Siempre partir del máximo persistido para no saltear el hueco hasta lo nuevo.
  // Si no hay datos locales, usar el ancla de la home.
  const startFrom = Number.isFinite(maxKnownId) ? maxKnownId : homeAnchorId

  if (!Number.isFinite(startFrom)) {
    throw new Error('No se pudo determinar un id ancla de votaciones')
  }

  const hasKnownIds = Number.isFinite(maxKnownId)
  // Sin home (captcha), barrido corto hacia adelante — no +250 en paralelo.
  let forwardCount = Number.isFinite(homeAnchorId)
    ? FORWARD_WITH_HOME
    : FORWARD_WITHOUT_HOME
  if (Number.isFinite(homeAnchorId) && homeAnchorId > startFrom) {
    forwardCount = Math.max(forwardCount, homeAnchorId - startFrom + 20)
  }

  const forwardIds = Array.from({ length: forwardCount }, (_, i) =>
    String(startFrom + i + (hasKnownIds ? 1 : 0)),
  )
  const backwardIds = Array.from(
    { length: hasKnownIds ? BACKWARD_WITH_DATA : BACKWARD_WITHOUT_DATA },
    (_, i) => String(startFrom - i - (hasKnownIds ? 0 : 1)),
  )

  const allIds = [...new Set([...forwardIds, ...backwardIds])]

  return allIds
    .filter(id => Number(id) > 0 && !currentIds.includes(id))
    .map(id => `${VOTACIONES_BASE_URL}/votacion/${id}`)
}

function resolveMaxId(currentIds: string[]): number {
  const numericIds = currentIds
    .map(Number)
    .filter(id => Number.isFinite(id) && id > 0)

  if (numericIds.length === 0) {
    return Number.NaN
  }

  return Math.max(...numericIds)
}

async function resolveAnchorIdFromHome(): Promise<number> {
  try {
    const response = await axios.get(VOTACIONES_BASE_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${VOTACIONES_BASE_URL}/`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      validateStatus: status => status < 500,
      timeout: 30_000,
    })

    if (response.status !== 200) {
      console.warn(`Home de votaciones HTTP ${response.status}`)
      return Number.NaN
    }

    const $ = cheerio.load(response.data)
    const links = $('a[href^="/votacion/"]')
      .map((_, element) => $(element).attr('href'))
      .get()
      .filter(Boolean) as string[]

    if (links.length === 0) {
      console.warn('Home de votaciones sin links /votacion/ (captcha o bloqueo)')
      return Number.NaN
    }

    // Tomar el id más alto visible en la home, no el primero del DOM.
    const ids = links
      .map(href => Number(href.split('/').pop()))
      .filter(id => Number.isFinite(id) && id > 0)

    return ids.length ? Math.max(...ids) : Number.NaN
  }
  catch (error) {
    console.warn('Error al consultar home de votaciones', error)
    return Number.NaN
  }
}

async function parseVotacionPage(url: string) {
  const id = url.split('/').pop() as string

  try {
    const response = await fetchWithRetry(url)

    if (!response) {
      throw new Error('Empty response')
    }

    // Cabecera PDF se enriquece en batch después (evita HTML+PDF en paralelo).
    return parseActa(id, response.data)
  }
  catch (error: any) {
    const status = error.response?.status
    if (status === 404 || status === 417) {
      // HCDN responde 417 cuando el acta no existe.
      return null
    }
    if (status === 403) {
      console.warn('Forbidden access', { url })
    }
    else {
      console.warn('Error al obtener votacion', { url, status, message: error.message })
    }
    return null
  }
}

function applyCabeceraPdf(
  acta: Acta,
  cabecera: NonNullable<Awaited<ReturnType<typeof parseCabeceraPdf>>>,
): Acta {
  return {
    ...acta,
    sesion: cabecera.sesion ?? acta.sesion ?? null,
    votacion: cabecera.votacion ?? acta.votacion ?? null,
    mayoria: cabecera.mayoria ?? acta.mayoria ?? null,
    baseMayoria: cabecera.baseMayoria ?? acta.baseMayoria ?? null,
    tipoMayoria: cabecera.tipoMayoria ?? acta.tipoMayoria ?? null,
    miembros: cabecera.miembros ?? acta.miembros ?? null,
    presentes: cabecera.presentes ?? acta.presentes ?? null,
    sinVotar: cabecera.sinVotar ?? acta.sinVotar ?? null,
    ultModVer: cabecera.ultModVer ?? acta.ultModVer ?? null,
    resultado: cabecera.resultado || acta.resultado,
    presidente: cabecera.presidente
      ? titleCaseSpanish(cabecera.presidente.toLowerCase())
      : acta.presidente,
  }
}

function parseActa(id: string, html: string): Acta | null {
  const $ = cheerio.load(html)

  const title = $('h5 b').text().trim()
  if (!title) {
    return null
  }

  const [periodo, reunion, numeroActa] = title
    .split(' - ')
    .map(s => s.replace(/\D+/g, '')) // Extract numbers
  const titulo = $('ul.col h4.black-opacity').clone().children('h5').remove().end().text().trim()
  const resultado = $('ul.col-in li.col-middle h3').text().trim().toLowerCase()
  const dateTime = $('ul.col h5.text-muted').text().trim()
  const [fecha, hora] = dateTime.split(' - ')
  const fechaHora = parseFechaHora(fecha, hora)

  if (!fecha || !hora || Number.isNaN(fechaHora.getTime())) {
    return null
  }

  const presidente = titleCaseSpanish(
    $('div#custom-share h4 b').text().trim().toLowerCase(),
  )

  // HTML: "Más de la mitad - Votos Emitidos"
  const mayoriaRaw = $('ul.col-in li.col-middle h5.text-muted').text().trim()
  let mayoria: string | null = mayoriaRaw || null
  let tipoMayoria: string | null = null
  let baseMayoria: string | null = null
  if (mayoriaRaw.includes(' - ')) {
    const [tipo, base] = mayoriaRaw.split(/\s+-\s+/, 2)
    tipoMayoria = tipo?.trim() || null
    baseMayoria = base?.trim() || null
    mayoria = [tipoMayoria, baseMayoria].filter(Boolean).join(' — ')
  }

  const afirmativosUl = $(
    'div.col-lg-2.col-sm-6 ul h4:contains("AFIRMATIVOS")',
  ).parent()
  const negativosUl = $(
    'div.col-lg-2.col-sm-6 ul h4:contains("NEGATIVOS")',
  ).parent()
  const abstencionesUl = $(
    'div.col-lg-2.col-sm-6 ul h4:contains("ABSTENCIONES")',
  ).parent()
  const ausentesUl = $(
    'div.col-lg-2.col-sm-6 ul h4:contains("AUSENTES")',
  ).parent()
  const sinVotarUl = $(
    'div.col-lg-2.col-sm-6 ul h4:contains("SIN VOTAR")',
  ).parent()

  const votosAfirmativos
    = Number.parseInt(afirmativosUl.find('h3').text().trim(), 10) || 0
  const votosNegativos
    = Number.parseInt(negativosUl.find('h3').text().trim(), 10) || 0
  const abstenciones
    = Number.parseInt(abstencionesUl.find('h3').text().trim(), 10) || 0
  const ausentes = Number.parseInt(ausentesUl.find('h3').text().trim(), 10) || 0
  const sinVotarRaw = Number.parseInt(sinVotarUl.find('h3').text().trim(), 10)
  const sinVotar = Number.isFinite(sinVotarRaw) ? sinVotarRaw : null
  const presentes
    = votosAfirmativos + votosNegativos + abstenciones + (sinVotar ?? 0)

  const votos: Voto[] = []
  $('#myTable tbody tr').each((_, row) => {
    const imagen = $(row).find('td:nth-child(1) img').attr('src') || ''
    const diputado = titleCaseSpanish(
      $(row).find('td:nth-child(2)').text().trim().toLowerCase(),
    )
    const tipoVoto = parseTipoVoto(
      $(row).find('td:nth-child(5) span.label').text().trim()
      || $(row).find('td:nth-child(5)').text().trim(),
    )
    const videoButton = $(row).find('td:nth-child(6) button')
    const videoDiscurso
      = videoButton.length > 0 && !videoButton.prop('disabled')
        ? videoButton.attr('onclick')?.match(/'([^']+)'/)?.[1] || null
        : null

    // Update diputado with missing photo.
    diputados.filter((d: any) => `${d.apellido}, ${d.nombre}` === diputado)
      .forEach((d: any) => {
        if (!d.foto) {
          d.foto = imagen
        }
      })

    votos.push({
      diputado,
      tipoVoto,
      imagen,
      videoDiscurso,
    })
  })

  if (votos.length === 0) {
    return null
  }

  return {
    id,
    periodo,
    reunion,
    numeroActa,
    titulo,
    resultado,
    fecha: fechaHora,
    presidente,
    votosAfirmativos,
    votosNegativos,
    abstenciones,
    ausentes,
    votos,
    mayoria,
    tipoMayoria,
    baseMayoria,
    sinVotar,
    presentes: presentes || null,
    votacion: null,
    sesion: null,
    miembros: null,
    ultModVer: null,
  }
}

function parseTipoVoto(voto: string): TipoVoto {
  if (voto.includes('AFIRMATIVO')) {
    return TipoVoto.Afirmativo
  }
  if (voto.includes('NEGATIVO')) {
    return TipoVoto.Negativo
  }
  if (voto.includes('ABSTENCIÓN') || voto.includes('ABSTENCION')) {
    return TipoVoto.Abstencion
  }
  if (voto.includes('AUSENTE')) {
    return TipoVoto.Ausente
  }
  if (voto.includes('PRESIDENTE')) {
    return TipoVoto.Presidente
  }
  return TipoVoto.Ausente
}

function parseFechaHora(fecha: string, hora: string): Date {
  return parse(`${fecha} ${hora}`, 'dd/MM/yyyy HH:mm', new Date())
}
