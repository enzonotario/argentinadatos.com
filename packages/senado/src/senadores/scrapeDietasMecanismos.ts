import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { hasFirecrawlCredentials, requestFirecrawl } from './firecrawlClient.ts'

export const DIETAS_MECANISMOS_URL
  = 'https://www.senado.gob.ar/bundles/senadoportal/webNueva/pdf/dietas/mecanismos.pdf'

export const DIETAS_MECANISMOS_ENDPOINT = '/senado/senadores/dietas-mecanismos'

export interface DietaMecanismosRow {
  nombre: string
  provincia: string
  renunciaAlAumento: boolean
  donacion: boolean
  aportesPartidarios: boolean
}

export interface DietasMecanismosCache {
  fuente: string
  scrapedAt: string
  senadores: DietaMecanismosRow[]
}

export interface SenadorDietaMeta {
  renunciaAlAumento: boolean
  donacion: boolean
  aportesPartidarios: boolean
  fuente: string
  actualizado: string
}

const PROMPT = `Extraé TODAS las filas de la tabla de senadores del PDF (ambas páginas).
Columnas: SENADOR, PROVINCIA, RENUNCIA AL AUMENTO, DONACIÓN, APORTES PARTIDARIOS.
Para las tres últimas columnas: true si dice sí/SI/SÍ (cualquier capitalización), false si está vacío o no hay valor.
No omitas filas aunque las tres banderas sean false.`

const SCHEMA = {
  type: 'object',
  required: ['senadores'],
  properties: {
    senadores: {
      type: 'array',
      description: 'Filas completas del listado de dietas/mecanismos',
      items: {
        type: 'object',
        properties: {
          nombre: {
            type: 'string',
            description: 'Apellido, Nombre(s) como en la columna SENADOR',
          },
          provincia: {
            type: 'string',
            description: 'Provincia como en la columna PROVINCIA',
          },
          renunciaAlAumento: {
            type: 'boolean',
            description: 'true si RENUNCIA AL AUMENTO es sí',
          },
          donacion: {
            type: 'boolean',
            description: 'true si DONACIÓN es sí',
          },
          aportesPartidarios: {
            type: 'boolean',
            description: 'true si APORTES PARTIDARIOS es sí',
          },
        },
        required: [
          'nombre',
          'provincia',
          'renunciaAlAumento',
          'donacion',
          'aportesPartidarios',
        ],
      },
    },
  },
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v === 'sí' || v === 'si' || v === 'true' || v === '1' || v === 'x'
  }
  return false
}

function normalizeRow(raw: any): DietaMecanismosRow | null {
  const nombre = String(raw?.nombre || '').replace(/\s+/g, ' ').trim()
  const provincia = String(raw?.provincia || '').replace(/\s+/g, ' ').trim()
  if (!nombre) {
    return null
  }
  return {
    nombre,
    provincia,
    renunciaAlAumento: normalizeBool(raw?.renunciaAlAumento),
    donacion: normalizeBool(raw?.donacion),
    aportesPartidarios: normalizeBool(raw?.aportesPartidarios),
  }
}

export function readDietasMecanismosCache(): DietasMecanismosCache | null {
  const raw = readEndpoint(DIETAS_MECANISMOS_ENDPOINT)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as DietasMecanismosCache
    if (!parsed || !Array.isArray(parsed.senadores) || parsed.senadores.length === 0) {
      return null
    }
    return parsed
  }
  catch {
    return null
  }
}

export function writeDietasMecanismosCache(cache: DietasMecanismosCache): void {
  writeEndpoint(DIETAS_MECANISMOS_ENDPOINT, cache)
}

async function scrapeDietasMecanismosFromFirecrawl(): Promise<DietasMecanismosCache> {
  if (!hasFirecrawlCredentials()) {
    throw new Error('Faltan credenciales VITE_FIRECRAWL_* para scrapear dietas/mecanismos')
  }

  const requestBody = {
    url: DIETAS_MECANISMOS_URL,
    onlyMainContent: true,
    maxAge: 0,
    parsers: ['pdf'],
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
      `Firecrawl dietas/mecanismos falló: ${response.status} ${response.statusText}. ${body.slice(0, 400)}`,
    )
  }

  const payload = await response.json()
  if (!payload?.success) {
    throw new Error('Firecrawl dietas/mecanismos: success=false')
  }

  const json = payload?.data?.json
  const rowsRaw = Array.isArray(json?.senadores) ? json.senadores : []
  const senadores = rowsRaw
    .map(normalizeRow)
    .filter((row: DietaMecanismosRow | null): row is DietaMecanismosRow => Boolean(row))

  if (senadores.length < 60) {
    throw new Error(
      `Firecrawl dietas/mecanismos: se esperaban ~72 filas, llegaron ${senadores.length}`,
    )
  }

  return {
    fuente: DIETAS_MECANISMOS_URL,
    scrapedAt: new Date().toISOString(),
    senadores,
  }
}

/**
 * Obtiene el listado del PDF de dietas/mecanismos.
 * Por defecto reutiliza caché en datos/ para no gastar créditos de Firecrawl.
 * Pasá `force: true` (o env VITE_DIETAS_FORCE_FIRECRAWL=1) para forzar scrape real.
 */
export async function scrapeDietasMecanismos(options?: {
  force?: boolean
}): Promise<DietasMecanismosCache> {
  const force
    = options?.force === true
      || process.env.VITE_DIETAS_FORCE_FIRECRAWL === '1'
      || (import.meta as any).env?.VITE_DIETAS_FORCE_FIRECRAWL === '1'

  if (!force) {
    const cached = readDietasMecanismosCache()
    if (cached) {
      return cached
    }
  }

  const scraped = await scrapeDietasMecanismosFromFirecrawl()
  writeDietasMecanismosCache(scraped)
  return scraped
}

export function foldNombre(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9,\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function claveApellidoNombre(nombre: string): string | null {
  const folded = foldNombre(nombre)
  if (!folded) {
    return null
  }

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

  if (!apellidos[0] || !nombres[0]) {
    return null
  }
  return `${apellidos[0]}|${nombres[0]}`
}

export function matchDietaRowToSenadorNombre(
  rowNombre: string,
  senadorNombre: string,
): boolean {
  if (foldNombre(rowNombre) === foldNombre(senadorNombre)) {
    return true
  }
  const a = claveApellidoNombre(rowNombre)
  const b = claveApellidoNombre(senadorNombre)
  return Boolean(a && b && a === b)
}

export function buildDietaMeta(
  row: DietaMecanismosRow,
  cache: DietasMecanismosCache,
): SenadorDietaMeta {
  return {
    renunciaAlAumento: row.renunciaAlAumento,
    donacion: row.donacion,
    aportesPartidarios: row.aportesPartidarios,
    fuente: cache.fuente,
    actualizado: cache.scrapedAt,
  }
}

/**
 * Aplica filas del PDF a senadores existentes vía match de nombre.
 * Escribe `meta.dieta` en todos los mandatos del id matcheado.
 */
export function applyDietasMecanismosMeta<T extends {
  id: string
  nombre: string
  meta?: { dieta?: SenadorDietaMeta } | null
}>(senadores: T[], cache: DietasMecanismosCache): {
  senadores: T[]
  matchedIds: string[]
  unmatchedRows: DietaMecanismosRow[]
} {
  const matchedIds = new Set<string>()
  const unmatchedRows: DietaMecanismosRow[] = []

  for (const row of cache.senadores) {
    const hits = senadores.filter(s => matchDietaRowToSenadorNombre(row.nombre, s.nombre))
    if (hits.length === 0) {
      unmatchedRows.push(row)
      continue
    }

    const meta = buildDietaMeta(row, cache)
    const ids = new Set(hits.map(h => String(h.id)))
    for (const id of ids) {
      matchedIds.add(id)
      for (const s of senadores) {
        if (String(s.id) !== id) {
          continue
        }
        s.meta = {
          ...(s.meta || {}),
          dieta: meta,
        }
      }
    }
  }

  return {
    senadores,
    matchedIds: [...matchedIds],
    unmatchedRows,
  }
}
