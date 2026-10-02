import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import {
  buildEscalaSalarial,
  ESCALA_SALARIAL_ENDPOINT,
  ESCALA_SALARIAL_URL,
  parseNumeroAr,
  type EscalaSalarial,
} from './escalaSalarial.ts'
import { hasFirecrawlCredentials, requestFirecrawl } from './firecrawlClient.ts'

/**
 * Seed offline (marzo 2026) — se usa si no hay caché ni Firecrawl.
 * El crawl real puede actualizar valorModulo vía Firecrawl.
 */
export const ESCALA_SEED_VALOR_MODULO = 2784.456902
export const ESCALA_SEED_VIGENCIA = '2026-03'

const PROMPT = `Del documento de ESCALA SALARIAL del Senado (imagen o PDF), extraé:
- valorModulo: número decimal del VALOR MÓDULO (ej. 2784,456902 → 2784.456902)
- vigencia: texto de vigencia (ej. "DESDE MARZO DE 2026" → "2026-03")
- totalEnPesosCategoria1: Total en pesos de la categoría 1 (para validar)`

const SCHEMA = {
  type: 'object',
  required: ['valorModulo'],
  properties: {
    valorModulo: {
      type: 'number',
      description: 'Valor del módulo salarial',
    },
    vigencia: {
      type: 'string',
      description: 'Vigencia en formato YYYY-MM si es posible',
    },
    totalEnPesosCategoria1: {
      type: 'number',
      description: 'Total en pesos categoría 1',
    },
  },
}

export function readEscalaSalarialCache(): EscalaSalarial | null {
  const raw = readEndpoint(ESCALA_SALARIAL_ENDPOINT)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as EscalaSalarial
    if (!parsed?.valorModulo || !Array.isArray(parsed.categorias) || parsed.categorias.length !== 14) {
      return null
    }
    return parsed
  }
  catch {
    return null
  }
}

export function writeEscalaSalarialCache(escala: EscalaSalarial): void {
  writeEndpoint(ESCALA_SALARIAL_ENDPOINT, escala)
}

export function buildEscalaFromSeed(scrapedAt?: string): EscalaSalarial {
  return buildEscalaSalarial({
    valorModulo: ESCALA_SEED_VALOR_MODULO,
    vigencia: ESCALA_SEED_VIGENCIA,
    scrapedAt: scrapedAt || new Date().toISOString(),
    fuente: ESCALA_SALARIAL_URL,
  })
}

function normalizeVigencia(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null
  }
  const s = raw.trim()
  const iso = s.match(/^(\d{4})-(\d{2})/)
  if (iso) {
    return `${iso[1]}-${iso[2]}`
  }
  const months: Record<string, string> = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    setiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12',
  }
  const m = s.toLowerCase().match(
    /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de\s*)?(\d{4})/,
  )
  if (m) {
    return `${m[2]}-${months[m[1]]}`
  }
  return s
}

async function scrapeValorModuloFromFirecrawl(): Promise<{
  valorModulo: number
  vigencia: string | null
}> {
  if (!hasFirecrawlCredentials()) {
    throw new Error('Faltan credenciales VITE_FIRECRAWL_* para scrapear escala salarial')
  }

  const requestBody = {
    url: ESCALA_SALARIAL_URL,
    onlyMainContent: true,
    maxAge: 0,
    formats: [
      'markdown',
      {
        type: 'json',
        prompt: PROMPT,
        schema: SCHEMA,
      },
    ],
  }

  const response = await requestFirecrawl(requestBody)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Firecrawl escala salarial falló: ${response.status} ${response.statusText}. ${body.slice(0, 400)}`,
    )
  }

  const payload = await response.json()
  if (!payload?.success) {
    throw new Error('Firecrawl escala salarial: success=false')
  }

  const json = payload?.data?.json || {}
  const valorModulo = parseNumeroAr(json.valorModulo)
  if (!valorModulo || valorModulo < 100 || valorModulo > 1_000_000) {
    throw new Error(`Firecrawl escala salarial: valorModulo inválido (${json.valorModulo})`)
  }

  // Validación opcional: Total cat.1 ≈ 845 * valorModulo
  const totalCat1 = parseNumeroAr(json.totalEnPesosCategoria1)
  if (totalCat1) {
    const expected = Math.round(845 * valorModulo * 100) / 100
    const delta = Math.abs(totalCat1 - expected) / expected
    if (delta > 0.05) {
      console.warn(
        `Escala salarial: total cat.1 scrapeado (${totalCat1}) difiere de 845*módulo (${expected})`,
      )
    }
  }

  return {
    valorModulo,
    vigencia: normalizeVigencia(json.vigencia),
  }
}

/**
 * Obtiene la escala salarial.
 * Por defecto reutiliza caché. Sin caché: seed offline.
 * Con force + Firecrawl: re-scrape del adjunto oficial.
 */
export async function scrapeEscalaSalarial(options?: {
  force?: boolean
}): Promise<EscalaSalarial> {
  const force
    = options?.force === true
      || process.env.VITE_ESCALA_FORCE_FIRECRAWL === '1'
      || (import.meta as any).env?.VITE_ESCALA_FORCE_FIRECRAWL === '1'

  if (!force) {
    const cached = readEscalaSalarialCache()
    if (cached) {
      return cached
    }
  }

  if (force || hasFirecrawlCredentials()) {
    try {
      const scraped = await scrapeValorModuloFromFirecrawl()
      const escala = buildEscalaSalarial({
        valorModulo: scraped.valorModulo,
        vigencia: scraped.vigencia,
        scrapedAt: new Date().toISOString(),
        fuente: ESCALA_SALARIAL_URL,
      })
      writeEscalaSalarialCache(escala)
      return escala
    }
    catch (e) {
      if (force) {
        throw e
      }
      console.warn(
        'Escala salarial: Firecrawl falló, uso seed/caché',
        (e as Error)?.message || e,
      )
    }
  }

  const cached = readEscalaSalarialCache()
  if (cached) {
    return cached
  }

  const seed = buildEscalaFromSeed()
  writeEscalaSalarialCache(seed)
  return seed
}
