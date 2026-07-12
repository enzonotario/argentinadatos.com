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
}

const currentValues = JSON.parse(readEndpoint('diputados/actas') || '[]')

const diputados = JSON.parse(readEndpoint('diputados/diputados') || '[]')

export async function crawlActas(): Promise<Acta[]> {
  const currentIds = collect(currentValues).pluck('id').all() as string[]

  const votacionesUrls = await getVotacionesUrls(currentIds)

  const newValues = (
    await Promise.all(votacionesUrls.map(url => parseVotacionPage(url)))
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
    .unique(
      (acta: Acta) =>
        `${acta.periodo}-${acta.reunion}-${acta.numeroActa}`,
    )
    .sortBy('fecha')
    .all() as Acta[]

  if (shouldWriteJsonFiles()) {
    writeEndpoint('diputados/actas', actas)

    collect(actas)
      .groupBy((acta: Acta) => getYear(acta.fecha))
      // @ts-expect-error: TS can't infer the type of the collection
      .map((actas: Collection<Acta>, year: number) => ({
        year,
        actas: actas
          .sortBy('fecha')
          .all(),
      }))
      .each(({ year, actas }) => writeEndpoint(`diputados/actas/${year}`, actas))

    writeEndpoint('diputados/diputados', diputados)
  }

  const TURSO_DATABASE_URL = process.env.VITE_TURSO_DATABASE_URL
  const TURSO_AUTH_TOKEN = process.env.VITE_TURSO_AUTH_TOKEN

  if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN && shouldWriteFromDatabase()) {
    const db = new ActasDatabaseService(TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)

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

  writeEndpoint('diputados/actas', todosLosDatos)

  const years = collect(actas)
    .groupBy((acta: Acta) => getYear(acta.fecha))
    .all()

  for (const [year, actasByYear] of Object.entries(years)) {
    const yearNum = Number(year)
    if (isNaN(yearNum) || !isFinite(yearNum)) {
      continue
    }
    const actasData = await db.getActasByAño(yearNum)
    writeEndpoint(`diputados/actas/${year}`, actasData)
  }
}

async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
        },
        validateStatus: status => status < 500,
      })

      if (response.status === 404 || response.status === 417 || response.status === 403) {
        const error: any = new Error(`HTTP ${response.status}`)
        error.response = response
        throw error
      }

      return response
    }
    catch (error: any) {
      const status = error?.response?.status
      // 403/404/417 no tienen sentido reintentar.
      if (status === 403 || status === 404 || status === 417 || i === retries - 1) {
        throw error
      }
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
  // Sin home (captcha), no sabemos el techo: barrer más hacia adelante.
  let forwardCount = Number.isFinite(homeAnchorId) ? 150 : 250
  if (Number.isFinite(homeAnchorId) && homeAnchorId > startFrom) {
    forwardCount = Math.max(forwardCount, homeAnchorId - startFrom + 40)
  }

  const forwardIds = Array.from({ length: forwardCount }, (_, i) =>
    String(startFrom + i + (hasKnownIds ? 1 : 0)),
  )
  const backwardIds = Array.from({ length: hasKnownIds ? 15 : 40 }, (_, i) =>
    String(startFrom - i - (hasKnownIds ? 0 : 1)),
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
      },
      validateStatus: status => status < 500,
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

  const votosAfirmativos
    = Number.parseInt(afirmativosUl.find('h3').text().trim(), 10) || 0
  const votosNegativos
    = Number.parseInt(negativosUl.find('h3').text().trim(), 10) || 0
  const abstenciones
    = Number.parseInt(abstencionesUl.find('h3').text().trim(), 10) || 0
  const ausentes = Number.parseInt(ausentesUl.find('h3').text().trim(), 10) || 0

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
