/**
 * One-off: enriquece cabeceras PDF de todas las actas en datos/v1/diputados/actas.
 *
 *   cd packages/diputados && pnpm exec tsx src/diputados/actas/enrichCabeceras.ts
 *   # o: node --import tsx ...
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'
import { getStaticPath } from '@argentinadatos/core/src/utils/getStaticPath.ts'
import { parseCabeceraPdf } from './parseCabeceraPdf.ts'

const CONCURRENCY = 8
const DATOS_ACTAS = join(
  // packages/diputados/src/diputados/actas -> repo root datos
  process.cwd(),
  '../../datos/v1/diputados/actas',
)

type Acta = Record<string, unknown> & {
  id: string | number
  fecha?: string
  presidente?: string
  miembros?: number | null
  sesion?: string | null
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function saveJson(path: string, data: unknown) {
  writeFileSync(path, `${JSON.stringify(data)}\n`)
}

function yearOf(acta: Acta): string | null {
  const f = String(acta.fecha || '')
  const m = f.match(/^(\d{4})/)
  return m?.[1] || null
}

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
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  )
  return out
}

function applyCabecera(acta: Acta, cabecera: NonNullable<Awaited<ReturnType<typeof parseCabeceraPdf>>>): Acta {
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

async function main() {
  // Prefer repo datos path; fallback via getStaticPath if cwd differs
  let actasPath = join(DATOS_ACTAS, 'index.json')
  if (!existsSync(actasPath)) {
    actasPath = getStaticPath('/diputados/actas/index.json').replace(
      /\/index\.json$/,
      '',
    )
    // getStaticPath returns file path under datos
    const alt = join(
      process.cwd(),
      '../../../datos/v1/diputados/actas/index.json',
    )
    actasPath = existsSync(alt) ? alt : actasPath
  }

  const root = actasPath.endsWith('index.json')
    ? actasPath.replace(/\/index\.json$/, '')
    : join(process.cwd(), '../../datos/v1/diputados/actas')

  const indexPath = join(root, 'index.json')
  console.log('Leyendo', indexPath)
  const actas = loadJson<Acta[]>(indexPath)
  console.log(`Actas: ${actas.length}`)

  const byId = new Map<string, number>()
  actas.forEach((a, i) => byId.set(String(a.id), i))

  let ok = 0
  let fail = 0
  let skip = 0
  const started = Date.now()

  await mapPool(actas, CONCURRENCY, async (acta, index) => {
    const id = String(acta.id)
    // Re-enrich all (user reset datos); skip only if already has miembros+sesion
    if (acta.miembros != null && acta.sesion) {
      skip++
      return
    }
    try {
      const cabecera = await parseCabeceraPdf(id)
      if (!cabecera || (cabecera.miembros == null && !cabecera.sesion && !cabecera.mayoria)) {
        fail++
        if (fail <= 15 || fail % 50 === 0) {
          console.warn(`  sin cabecera útil: ${id}`)
        }
        return
      }
      actas[index] = applyCabecera(acta, cabecera)
      ok++
      if (ok % 25 === 0 || ok === 1) {
        const elapsed = ((Date.now() - started) / 1000).toFixed(0)
        console.log(
          `  ok=${ok} fail=${fail} skip=${skip} (${elapsed}s) último=${id}`,
        )
      }
    }
    catch (e: any) {
      fail++
      if (fail <= 15) console.warn(`  error ${id}:`, e?.message || e)
    }
  })

  console.log(`Listo: ok=${ok} fail=${fail} skip=${skip}`)
  console.log('Escribiendo index.json…')
  saveJson(indexPath, actas)

  // Year indexes
  const byYear = new Map<string, Acta[]>()
  for (const a of actas) {
    const y = yearOf(a)
    if (!y) continue
    const list = byYear.get(y) || []
    list.push(a)
    byYear.set(y, list)
  }
  for (const [year, list] of byYear) {
    const yearPath = join(root, year, 'index.json')
    if (!existsSync(join(root, year))) continue
    // Keep year file in sync with enriched actas (same objects)
    saveJson(yearPath, list)
    console.log(`  ${year}: ${list.length} actas`)
  }

  const withM = actas.filter(a => a.miembros != null).length
  const withS = actas.filter(a => a.sesion).length
  console.log(`Cobertura: miembros=${withM}/${actas.length} sesion=${withS}/${actas.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
