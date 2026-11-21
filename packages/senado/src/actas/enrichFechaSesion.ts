/**
 * Backfill `fechaSesion` from the official Senate listing (no PDF re-download).
 *
 *   cd packages/senado && pnpm exec tsx src/actas/enrichFechaSesion.ts
 *   # optional: --year=2026 (default: current + previous year)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as cheerio from 'cheerio'
import { collectListedActas } from './crawlActas.ts'

const ROOT_DATOS = join(process.cwd(), '../../datos/v1/senado/actas')

type Acta = Record<string, unknown> & {
  actaId?: number | string
  fechaSesion?: string
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function saveJson(path: string, data: unknown) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

async function fetchListed(year: number) {
  const response = await fetch('https://www.senado.gob.ar/votaciones/actas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `busqueda_actas%5Banio%5D=${year}&busqueda_actas%5Btitulo%5D=&x=42&y=8`,
  })
  const html = await response.text()
  const $ = cheerio.load(html)
  return collectListedActas($, $('table#actasTable tbody tr'))
}

export async function enrichFechaSesionForYear(
  year: number,
  fechaById?: Map<number, string>,
): Promise<{ updated: number, listed: number, fechaById: Map<number, string> }> {
  const listed = await fetchListed(year)
  const byId = fechaById ?? new Map<number, string>()
  for (const row of listed) {
    if (row.fechaSesion) byId.set(row.id, row.fechaSesion)
  }

  const yearPath = join(ROOT_DATOS, String(year), 'index.json')
  if (!existsSync(yearPath)) {
    console.warn(`enrichFechaSesion ${year}: no existe ${yearPath}`)
    return { updated: 0, listed: listed.length, fechaById: byId }
  }

  const yearList = loadJson<Acta[]>(yearPath)
  if (!Array.isArray(yearList)) {
    return { updated: 0, listed: listed.length, fechaById: byId }
  }

  let updated = 0
  const nextYear = yearList.map((acta) => {
    const id = Number(acta?.actaId)
    const fechaSesion = byId.get(id)
    if (!fechaSesion || acta.fechaSesion === fechaSesion) return acta
    updated += 1
    return { ...acta, fechaSesion }
  })

  if (updated) {
    saveJson(yearPath, nextYear)

    for (const [id, fechaSesion] of byId) {
      const detailPath = join(ROOT_DATOS, String(year), String(id), 'index.json')
      if (!existsSync(detailPath)) continue
      const detail = loadJson<Acta>(detailPath)
      if (detail.fechaSesion === fechaSesion) continue
      saveJson(detailPath, { ...detail, fechaSesion })
    }
  }

  console.log(
    `enrichFechaSesion ${year}: ${updated} actualizadas `
    + `(${byId.size} con fecha en listado / ${listed.length} filas)`,
  )

  return { updated, listed: listed.length, fechaById: byId }
}

function enrichGlobalIndex(byId: Map<number, string>) {
  const allPath = join(ROOT_DATOS, 'index.json')
  if (!existsSync(allPath) || !byId.size) return

  const allList = loadJson<Acta[]>(allPath)
  if (!Array.isArray(allList)) return

  let updated = 0
  const next = allList.map((acta) => {
    const id = Number(acta?.actaId)
    const fechaSesion = byId.get(id)
    if (!fechaSesion || acta.fechaSesion === fechaSesion) return acta
    updated += 1
    return { ...acta, fechaSesion }
  })

  if (updated) {
    saveJson(allPath, next)
    console.log(`enrichFechaSesion global: ${updated} actualizadas`)
  }
}

async function main() {
  const argYear = process.argv
    .find(a => a.startsWith('--year='))
    ?.slice('--year='.length)
  const now = new Date().getFullYear()
  const years = argYear
    ? [Number(argYear)]
    : [now, now - 1]

  const fechaById = new Map<number, string>()
  for (const year of years) {
    if (!Number.isFinite(year)) continue
    await enrichFechaSesionForYear(year, fechaById)
  }

  enrichGlobalIndex(fechaById)
}

const isDirectRun = process.argv[1]?.includes('enrichFechaSesion')
if (isDirectRun) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
