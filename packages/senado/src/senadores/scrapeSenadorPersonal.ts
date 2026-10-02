import * as cheerio from 'cheerio'
import { normalizeCategoriaCodigo } from './escalaSalarial.ts'
import type { PersonalAgente } from './scrapeBloquesPersonal.ts'

export const SENADOR_PAGE_URL = (id: string) =>
  `https://www.senado.gob.ar/senadores/senador/${id}`

export interface SenadorPersonal {
  senadorId: string
  personal: PersonalAgente[]
  fuente: string
}

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSenadorPersonalHtml(
  html: string,
  senadorId: string,
): SenadorPersonal {
  const $ = cheerio.load(html)
  const personal: PersonalAgente[] = []

  const $section = $('#Personal')
  $section.find('table tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 2) {
      return
    }
    const nombre = cleanText(cells.eq(0).text())
    const cat = normalizeCategoriaCodigo(cleanText(cells.eq(1).text()))
    if (!nombre || !cat) {
      return
    }
    // Evita filas de otras tablas coladas
    if (/^\d+\/\d+$/.test(nombre)) {
      return
    }
    personal.push({ nombre, categoria: cat })
  })

  return {
    senadorId: String(senadorId),
    personal,
    fuente: SENADOR_PAGE_URL(senadorId),
  }
}

export async function downloadSenadorPersonalHtml(id: string): Promise<string> {
  const response = await fetch(SENADOR_PAGE_URL(id), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept: 'text/html',
    },
  })
  if (!response.ok) {
    throw new Error(`Senador personal ${id}: HTTP ${response.status}`)
  }
  return response.text()
}

export async function scrapeSenadorPersonal(id: string): Promise<SenadorPersonal> {
  const html = await downloadSenadorPersonalHtml(id)
  return parseSenadorPersonalHtml(html, id)
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

/**
 * Scrapea el tab Personal de cada senador vigente.
 * Concurrencia baja para no martillar el Senado.
 */
export async function scrapeSenadoresPersonal(
  senadorIds: string[],
  options?: { concurrency?: number },
): Promise<SenadorPersonal[]> {
  const ids = [...new Set(senadorIds.map(String).filter(Boolean))]
  const concurrency = options?.concurrency ?? 4

  return mapPool(ids, concurrency, async (id) => {
    try {
      return await scrapeSenadorPersonal(id)
    }
    catch (e: any) {
      console.warn(`Senador personal ${id}: ${e?.message || e}`)
      return {
        senadorId: id,
        personal: [],
        fuente: SENADOR_PAGE_URL(id),
      }
    }
  })
}
