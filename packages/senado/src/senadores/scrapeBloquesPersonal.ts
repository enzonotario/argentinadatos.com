import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import * as cheerio from 'cheerio'
import { normalizeCategoriaCodigo } from './escalaSalarial.ts'

export const BLOQUES_AGRUPADOS_URL
  = 'https://www.senado.gob.ar/senadores/listados/agrupados-por-bloques'

export interface PersonalAgente {
  nombre: string
  categoria: string
}

export interface BloqueSenadorRef {
  id: string
  nombre: string
}

export interface BloquePersonal {
  id: string
  nombre: string
  presidente: string | null
  integrantes: number
  senadores: BloqueSenadorRef[]
  personal: PersonalAgente[]
  fuente: string
}

function cleanText(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractSenadorId(href: string | undefined): string | null {
  if (!href) {
    return null
  }
  const m = href.match(/\/senadores\/senador\/(\d+)/)
  return m?.[1] || null
}

export function parseBloquesPersonalHtml(html: string): BloquePersonal[] {
  const $ = cheerio.load(html)
  const bloques: BloquePersonal[] = []

  $('table.table-bordered tbody > tr').each((_, el) => {
    const $tr = $(el)
    const onclick = $tr.find('a[onclick*="ver("]').attr('onclick') || ''
    const idMatch = onclick.match(/ver\('(\d+)'\)/)
    if (!idMatch) {
      return
    }
    const id = idMatch[1]
    const nombreRaw = cleanText($tr.find('a[onclick*="ver("]').first().text())
    if (!nombreRaw) {
      return
    }

    const presidente = cleanText($tr.find('td').eq(1).text()) || null
    const integrantes = Number.parseInt(cleanText($tr.find('td').eq(2).text()), 10) || 0

    const $detail = $(`tr#${id}`)
    const senadores: BloqueSenadorRef[] = []
    $detail.find('a[href*="/senadores/senador/"]').each((__, a) => {
      const href = $(a).attr('href')
      const sid = extractSenadorId(href)
      const snombre = cleanText($(a).text())
      if (!sid || !snombre) {
        return
      }
      if (senadores.some(s => s.id === sid)) {
        return
      }
      senadores.push({ id: sid, nombre: titleCaseSpanish(snombre.toLowerCase()) })
    })

    const personal: PersonalAgente[] = []
    const detailHtml = $detail.html() || ''
    if (!/No tiene personal asignado/i.test(detailHtml)) {
      $detail.find('table tr').each((___, row) => {
        const cells = $(row).find('td')
        if (cells.length < 3) {
          return
        }
        const nombres = cleanText(cells.eq(0).text())
        const apellido = cleanText(cells.eq(1).text())
        const cat = normalizeCategoriaCodigo(cleanText(cells.eq(2).text()))
        if (!cat) {
          return
        }
        const nombre = cleanText(`${nombres} ${apellido}`)
        if (!nombre) {
          return
        }
        personal.push({ nombre, categoria: cat })
      })
    }

    bloques.push({
      id,
      // Mantener casing del sitio (p. ej. "UCR - Unión Cívica Radical").
      nombre: nombreRaw,
      presidente: presidente
        ? titleCaseSpanish(presidente.toLowerCase())
        : null,
      integrantes,
      senadores,
      personal,
      fuente: BLOQUES_AGRUPADOS_URL,
    })
  })

  return bloques
}

export async function downloadBloquesPersonalHtml(): Promise<string> {
  const response = await fetch(BLOQUES_AGRUPADOS_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept: 'text/html',
    },
  })
  if (!response.ok) {
    throw new Error(`Bloques personal: HTTP ${response.status}`)
  }
  return response.text()
}

export async function scrapeBloquesPersonal(): Promise<BloquePersonal[]> {
  const html = await downloadBloquesPersonalHtml()
  const bloques = parseBloquesPersonalHtml(html)
  if (bloques.length < 5) {
    throw new Error(`Bloques personal: se esperaban varios bloques, llegaron ${bloques.length}`)
  }
  return bloques
}
