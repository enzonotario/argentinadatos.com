/**
 * Backfill fechaSesion from Senate listing.
 *   node packages/senado/scripts/enrich-fecha-sesion.mjs [--year=2026]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DATOS = join(__dirname, '../../../datos/v1/senado/actas')

function parseFechaSesionListado(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  const compact = text.match(/\b(\d{4})(\d{2})(\d{2})\b/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  const dmy = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (!dmy) return undefined
  return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
}

function scrapeTitulo($td) {
  return $td
    .contents()
    .filter((_, node) => node.type === 'text')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
}

function collectListedActas($, actasRows) {
  const byId = new Map()
  for (const row of actasRows.toArray()) {
    const $row = $(row)
    const href = $row.find('a[href*="detalleActa"]').attr('href')
    if (!href) continue
    const id = Number(href.split('/').pop())
    if (!Number.isFinite(id)) continue
    const tds = $row.find('td')
    const fechaSesion = parseFechaSesionListado(tds.eq(0).text())
    const titulo = scrapeTitulo(tds.eq(2))
    const prev = byId.get(id)
    if (!prev || titulo || fechaSesion) {
      byId.set(id, {
        id,
        titulo: titulo || prev?.titulo || '',
        fechaSesion: fechaSesion || prev?.fechaSesion,
      })
    }
  }
  return [...byId.values()]
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function saveJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`)
}

async function fetchListed(year) {
  const response = await fetch('https://www.senado.gob.ar/votaciones/actas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `busqueda_actas%5Banio%5D=${year}&busqueda_actas%5Btitulo%5D=&x=42&y=8`,
  })
  const html = await response.text()
  const $ = cheerio.load(html)
  return collectListedActas($, $('table#actasTable tbody tr'))
}

async function enrichYear(year, fechaById) {
  const listed = await fetchListed(year)
  for (const row of listed) {
    if (row.fechaSesion) fechaById.set(row.id, row.fechaSesion)
  }

  const yearPath = join(ROOT_DATOS, String(year), 'index.json')
  if (!existsSync(yearPath)) {
    console.warn(`skip ${year}: missing ${yearPath}`)
    return { updated: 0, listed: listed.length }
  }

  const yearList = loadJson(yearPath)
  let updated = 0
  const nextYear = yearList.map((acta) => {
    const id = Number(acta?.actaId)
    const fechaSesion = fechaById.get(id)
    if (!fechaSesion || acta.fechaSesion === fechaSesion) return acta
    updated += 1
    return { ...acta, fechaSesion }
  })

  if (updated) {
    saveJson(yearPath, nextYear)
    for (const [id, fechaSesion] of fechaById) {
      const detailPath = join(ROOT_DATOS, String(year), String(id), 'index.json')
      if (!existsSync(detailPath)) continue
      const detail = loadJson(detailPath)
      if (detail.fechaSesion === fechaSesion) continue
      saveJson(detailPath, { ...detail, fechaSesion })
    }
  }

  console.log(
    `enrich ${year}: ${updated} updated (${fechaById.size} dated / ${listed.length} listed)`,
  )
  return { updated, listed: listed.length }
}

const argYear = process.argv.find(a => a.startsWith('--year='))?.slice(7)
const now = new Date().getFullYear()
const years = argYear ? [Number(argYear)] : [now, now - 1]
const fechaById = new Map()

for (const year of years) {
  if (!Number.isFinite(year)) continue
  await enrichYear(year, fechaById)
}

const allPath = join(ROOT_DATOS, 'index.json')
if (existsSync(allPath) && fechaById.size) {
  const allList = loadJson(allPath)
  let updated = 0
  const next = allList.map((acta) => {
    const id = Number(acta?.actaId)
    const fechaSesion = fechaById.get(id)
    if (!fechaSesion || acta.fechaSesion === fechaSesion) return acta
    updated += 1
    return { ...acta, fechaSesion }
  })
  if (updated) {
    saveJson(allPath, next)
    console.log(`enrich global: ${updated} updated`)
  }
}
