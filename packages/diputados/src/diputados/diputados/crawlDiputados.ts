import { getStaticPublicUrl } from '@argentinadatos/core/src/utils/getStaticPublicUrl.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { readStaticBuffer } from '@argentinadatos/core/src/utils/readStaticBuffer.ts'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'
import { shouldWriteJsonFiles, shouldWriteFromDatabase } from '@argentinadatos/core/src/utils/database-mode.ts'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { collect } from 'collect.js'
import { formatISO, parseISO } from 'date-fns'
import iconv from 'iconv-lite'
import { BASE_URL, USER_AGENT } from '../../constants.ts'
import { DiputadosDatabaseService } from './database/service.ts'

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
}

const currentValues = JSON.parse(
  readEndpoint('diputados/diputados') || '[]',
) as Diputado[]

export async function crawlDiputados(): Promise<Diputado[]> {
  const csv = await fetchLegisladoresCsv(`${BASE_URL}/dataset/legisladores`)

  const newValues = parseCsv(csv)

  const values = collect([
    ...currentValues,
    ...newValues,
  ])
    .sortBy('id')
    .sortBy('periodoMandato.inicio')
    .all() as Diputado[]

  const diputados = []

  for (const value of values) {
    diputados.push(
      await enhanceWithPhoto(value),
    )
  }

  if (shouldWriteJsonFiles()) {
    writeEndpoint('diputados/diputados', diputados)
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

async function generateEndpointEstatico(db: DiputadosDatabaseService) {
  const todosLosDatos = await db.getAllDiputados()

  writeEndpoint('diputados/diputados', todosLosDatos)
}

/**
 * El dataset publica varios recursos CSV/JSON. El primero ("Diputados") pasó a un
 * esquema nuevo sin ID (8 columnas). El histórico con ID sigue en otro resource
 * ("Composición Actual…"). Probamos los CSV hasta encontrar el schema esperado.
 */
async function fetchLegisladoresCsv(datasetUrl: string): Promise<string> {
  const response = await fetch(datasetUrl)
  const html = await response.text()
  const $ = cheerio.load(html)

  const resourceUrls = $('a.heading')
    .map((_, el) => $(el).attr('href'))
    .get()
    .filter((href): href is string => Boolean(href))
    .map(href => href.startsWith('http') ? href : `${BASE_URL}${href}`)

  if (resourceUrls.length === 0) {
    throw new Error('CSV Page URL not found')
  }

  const candidates: string[] = []

  for (const resourceUrl of resourceUrls) {
    const csvUrl = await parseCsvUrl(resourceUrl)
    if (!csvUrl) {
      continue
    }

    const csv = await getCsv(csvUrl)
    if (hasHistorialSchema(csv)) {
      return csv
    }

    candidates.push(csvUrl)
  }

  throw new Error(
    `No se encontró un CSV de legisladores con schema histórico (ID + 12 columnas). Recursos CSV: ${candidates.join(', ') || 'ninguno'}`,
  )
}

async function parseCsvUrl(resourceUrl: string): Promise<string | null> {
  const response = await fetch(resourceUrl)
  const html = await response.text()
  const $ = cheerio.load(html)

  return $('a[href$=".csv"]').attr('href') || null
}

async function getCsv(url: string): Promise<string> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
  })

  const buffer = Buffer.from(response.data)

  // Los CSV nuevos vienen en UTF-8; el histórico a veces en latin1.
  const asUtf8 = buffer.toString('utf8')
  if (!asUtf8.includes('\uFFFD') && /ID|APELLIDO/i.test(asUtf8.slice(0, 200))) {
    return asUtf8
  }

  return iconv.decode(buffer, 'latin1')
}

function hasHistorialSchema(csv: string): boolean {
  const header = csv.split(/\r?\n/, 1)[0] || ''
  const fields = header
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map(field => field.trim().replace(/^"|"$/g, '').toUpperCase())

  return fields.length === 12 && fields[0] === 'ID'
}

function parseCsv(csv: string): Diputado[] {
  const lines = csv.split('\n')

  return lines
    .slice(1)
    .map((line) => {
      const fields = line
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/) // Split by comma, but ignore commas inside quotes.
        .map(field => field.trim().replace(/^"|"$/g, '')) // Remove quotes around fields.

      if (fields.length !== 12) {
        console.warn('Invalid line', {
          line,
          fields,
        })
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
    .filter(diputado => diputado && diputado.periodoMandato.inicio)
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
    return formatISO(parseISO(value))
  }
  catch (error) {
    console.warn('Invalid fecha', {
      fecha,
      error,
    })
    return null
  }
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
      console.error('Error fetching foto', {
        path,
        foto,
        error,
      })
      attempts++
    }
  }

  if (!response) {
    throw new Error('Error fetching foto')
  }

  writeStaticBuffer(path, response.data)
}
