import axios from 'axios'
import * as cheerio from 'cheerio'
import { getStaticPath } from '@argentinadatos/core/src/utils/getStaticPath.ts'
import { getStaticPublicUrl } from '@argentinadatos/core/src/utils/getStaticPublicUrl.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { writeStaticBuffer } from '@argentinadatos/core/src/utils/writeStaticBuffer.ts'
import fs from 'node:fs'

export const PRESIDENCIA_URL = 'https://www.senado.gob.ar/presidencia'
export const PRESIDENCIA_ENDPOINT = '/senado/presidencia'

const SENADO_ORIGIN = 'https://www.senado.gob.ar'
const STATIC_FOTO_RELATIVE = '/senado/presidencia/presidente.gif'

export interface PresidenciaSenado {
  nombre: string
  cargo: string
  periodoInicio: string | null
  periodoFin: string | null
  foto: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  curriculum: string | null
  fuente: string
}

function absoluteSenadoUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) {
    return src
  }
  if (src.startsWith('//')) {
    return `https:${src}`
  }
  return `${SENADO_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
}

function parseDdMmYyyy(value: string): string | null {
  const m = String(value || '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) {
    return null
  }
  return `${m[3]}-${m[2]}-${m[1]}`
}

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse del HTML de https://www.senado.gob.ar/presidencia.
 */
export function parsePresidenciaHtml(html: string): Omit<PresidenciaSenado, 'foto' | 'fuente'> & {
  fotoSrc: string | null
} {
  const $ = cheerio.load(html)

  const $foto = $('img[alt*="Foto Presidente"], img[src*="autoridades/presidente"]').first()
  const fotoSrc = $foto.attr('src') ? absoluteSenadoUrl(String($foto.attr('src'))) : null

  // Nombre: div con font-size ~1.6em dentro del bloque de ficha
  let nombre = ''
  $('[style*="1.6em"], [style*="font-size:1.6"]').each((_, el) => {
    const text = cleanText($(el).text())
    if (text && text.length > 3 && text.length < 120 && !nombre) {
      nombre = text
    }
  })

  if (!nombre) {
    // Fallback: texto justo antes del cargo
    const bodyText = cleanText($('body').text())
    const m = bodyText.match(
      /([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.'\-\s]{2,80}?)\s+Presidente(?:\s+provisorio)?\s+del\s+Senado/i,
    )
    if (m) {
      nombre = cleanText(m[1])
    }
  }

  let cargo = 'Presidente del Senado de la Nación'
  $('[style*="#005CA9"], [style*="005ca9"]').each((_, el) => {
    const text = cleanText($(el).text())
    if (/presidente/i.test(text) && text.length < 80) {
      cargo = text
    }
  })
  if (!/presidente/i.test(cargo)) {
    const bodyText = cleanText($('body').text())
    const m = bodyText.match(
      /(Presidente(?:\s+provisorio)?\s+del\s+Senado(?:\s+de\s+la\s+Naci[oó]n)?)/i,
    )
    if (m) {
      cargo = cleanText(m[1])
    }
  }

  const bodyText = cleanText($('body').text())
  const periodo = bodyText.match(
    /Per[ií]odo\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i,
  )

  const email
    = cleanText($('a[href^="mailto:"]').first().text())
    || bodyText.match(/([a-z0-9._%+-]+@senado\.gob\.ar)/i)?.[1]
    || null

  const telefono
    = bodyText.match(/Te\.\s*([+\d()\s.-]+(?:\s*Int\.?\s*\d+)?)/i)?.[1]?.replace(/\s+/g, ' ').trim()
    || null

  let direccion: string | null = null
  const dirMatch = bodyText.match(
    /(Av\.?\s*Hip[oó]lito\s+Yrigoyen\s+\d+[\s\S]{0,80}?Argentina)/i,
  )
  if (dirMatch) {
    direccion = cleanText(dirMatch[1]).replace(/\s*Te\..*$/i, '').trim() || null
  }

  let curriculum: string | null = null
  const cvPane = cleanText($('#1').text() || $('h1:contains("Currículum")').parent().text())
  if (cvPane) {
    const cv = cleanText(
      cvPane
        .replace(/Curr[ií]culum\s*Vitae/i, '')
        .replace(/Curriculum\s*No\s*disponible/i, '')
        .trim(),
    )
    curriculum = cv || null
  }

  if (!nombre) {
    throw new Error('No se pudo parsear el nombre del presidente del Senado')
  }

  return {
    nombre,
    cargo,
    periodoInicio: periodo ? parseDdMmYyyy(periodo[1]!) : null,
    periodoFin: periodo ? parseDdMmYyyy(periodo[2]!) : null,
    fotoSrc,
    email: email || null,
    telefono,
    direccion,
    curriculum,
  }
}

async function downloadPresidenciaFoto(src: string | null): Promise<string | null> {
  if (!src) {
    return null
  }

  try {
    const response = await axios.get(src, {
      responseType: 'arraybuffer',
      timeout: 20_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaDatosBot/1.0)',
        Accept: 'image/*,*/*',
      },
      validateStatus: status => status >= 200 && status < 300,
    })

    const buffer = Buffer.from(response.data)
    // GIF/JPEG/PNG magic
    const isImage
      = (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
      || (buffer[0] === 0xff && buffer[1] === 0xd8)
      || (buffer[0] === 0x89 && buffer[1] === 0x50)
    if (!isImage) {
      console.error(`Foto presidencia no es imagen válida (${src})`)
      return localPresidenciaFotoUrl()
    }

    const path = writeStaticBuffer(STATIC_FOTO_RELATIVE, buffer)
    return getStaticPublicUrl(path)
  }
  catch (e: any) {
    console.error(`No se pudo descargar foto de presidencia desde ${src}:`, e?.message || e)
    return localPresidenciaFotoUrl()
  }
}

function localPresidenciaFotoUrl(): string | null {
  const filePath = getStaticPath(STATIC_FOTO_RELATIVE)
  if (fs.existsSync(filePath)) {
    return getStaticPublicUrl(filePath)
  }
  return null
}

export async function crawlPresidencia(): Promise<PresidenciaSenado> {
  const response = await fetch(PRESIDENCIA_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArgentinaDatosBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) {
    throw new Error(`Presidencia Senado: HTTP ${response.status}`)
  }

  const html = await response.text()
  const parsed = parsePresidenciaHtml(html)
  const foto = await downloadPresidenciaFoto(parsed.fotoSrc)

  const payload: PresidenciaSenado = {
    nombre: parsed.nombre,
    cargo: parsed.cargo,
    periodoInicio: parsed.periodoInicio,
    periodoFin: parsed.periodoFin,
    foto,
    email: parsed.email,
    telefono: parsed.telefono,
    direccion: parsed.direccion,
    curriculum: parsed.curriculum,
    fuente: PRESIDENCIA_URL,
  }

  writeEndpoint(PRESIDENCIA_ENDPOINT, payload)
  return payload
}
