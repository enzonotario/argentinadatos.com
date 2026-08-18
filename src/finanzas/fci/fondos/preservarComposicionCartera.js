import { execFileSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import {
  normalizarNombreFondo,
} from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'
import { descargarImagen } from '@/utils/imagenes.js'
import { leerRuta, existeRuta } from '@/utils/rutas.js'
import { preserveExistingPayloadFields } from '../../../../apps/cafci-worker/src/utils/preserveExistingPayloadFields.js'

const LOGOS_DIRECTORY = 'logos/fondos'
const STATIC_PUBLIC_BASE = 'https://api.argentinadatos.com/static/'
const HEAD_INDEX_PATH = 'datos/v1/finanzas/fci/fondos/index.json'

function leerFondoExportado(slug) {
  if (!slug) {
    return null
  }

  const ruta = `/finanzas/fci/fondos/${slug}`
  return existeRuta(ruta) ? leerRuta(ruta) : null
}

/**
 * Recupera campos CAFCI-only desde export en disco y/o index de git HEAD,
 * descarga logos a datos/static/logos/fondos/ y reescribe URLs públicas.
 */
export async function recuperarYLocalizarCamposFondo(fondos, dbPath) {
  const headByKey = loadHeadFondosIndex()
  let recuperados = 0

  for (const fondo of fondos) {
    const slug = normalizarNombreFondo(fondo)
    const fromDisk =
      leerFondoExportado(slug) ||
      (fondo.slug && fondo.slug !== slug ? leerFondoExportado(fondo.slug) : null)
    const fromHead =
      headByKey.byClaseId.get(String(fondo.claseId)) ||
      headByKey.bySlug.get(slug) ||
      headByKey.byNombre.get(normalizeName(fondo.nombre))

    const before = snapshotPreservedFields(fondo)

    if (fromDisk) {
      Object.assign(fondo, preserveExistingPayloadFields(fromDisk, fondo))
    }

    if (fromHead) {
      Object.assign(fondo, preserveExistingPayloadFields(fromHead, fondo))
    }

    if (snapshotPreservedFields(fondo) !== before) {
      recuperados += 1
    }
  }

  const logosLocalizados = await localizarLogosFondos(fondos)

  if ((recuperados > 0 || logosLocalizados > 0) && dbPath && existsSync(dbPath)) {
    persistirCamposEnSqlite(fondos, dbPath)
  }

  return {
    recuperados,
    logosLocalizados,
    headSources: headByKey.size,
  }
}

/** @deprecated usar recuperarYLocalizarCamposFondo */
export function recuperarComposicionCartera(fondos, dbPath) {
  let recuperados = 0

  for (const fondo of fondos) {
    if (fondo.composicionCartera?.length) {
      continue
    }

    const slug = normalizarNombreFondo(fondo)
    const existente = leerRuta(`/finanzas/fci/fondos/${slug}`)

    if (!existente?.composicionCartera?.length) {
      continue
    }

    fondo.composicionCartera = existente.composicionCartera
    recuperados += 1
  }

  if (recuperados > 0 && dbPath && existsSync(dbPath)) {
    persistirCamposEnSqlite(fondos, dbPath)
  }

  return recuperados
}

export async function localizarLogosFondos(fondos) {
  const cache = new Map()
  let localizados = 0

  for (const fondo of fondos) {
    if (!Array.isArray(fondo.sociedades)) {
      continue
    }

    for (const sociedad of fondo.sociedades) {
      if (!sociedad?.logo) {
        continue
      }

      const previous = sociedad.logo
      const localized = await resolveLogoUrl(sociedad.logo, cache)

      if (localized) {
        sociedad.logo = localized
        if (localized !== previous) {
          localizados += 1
        }
      }
    }
  }

  return localizados
}

export function logoFileStemFromUrl(logoUrl) {
  const pathname = new URL(logoUrl).pathname
  const fileName = basename(pathname)
  return fileName.replace(/\.[^.]+$/, '') || 'logo'
}

function loadHeadFondosIndex() {
  const byClaseId = new Map()
  const bySlug = new Map()
  const byNombre = new Map()

  if (process.env.VITEST) {
    return { byClaseId, bySlug, byNombre, size: 0 }
  }

  try {
    const raw = execFileSync('git', ['show', `HEAD:${HEAD_INDEX_PATH}`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const parsed = JSON.parse(raw)
    const fondos = parsed?.fondos || []

    for (const fondo of fondos) {
      if (fondo?.claseId != null) {
        byClaseId.set(String(fondo.claseId), fondo)
      }
      if (fondo?.slug) {
        bySlug.set(fondo.slug, fondo)
      } else if (fondo?.nombre) {
        bySlug.set(normalizarNombreFondo(fondo), fondo)
      }
      if (fondo?.nombre) {
        byNombre.set(normalizeName(fondo.nombre), fondo)
      }
    }
  } catch {
    // Sin git / sin index en HEAD: solo se usa el export en disco.
  }

  return {
    byClaseId,
    bySlug,
    byNombre,
    size: byClaseId.size,
  }
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function snapshotPreservedFields(fondo) {
  return JSON.stringify({
    composicionCartera: fondo.composicionCartera || [],
    benchmark: fondo.benchmark ?? null,
    duracion: fondo.duracion ?? null,
    horizonte: fondo.horizonte ?? null,
    region: fondo.region ?? null,
    calificaciones: fondo.calificaciones || [],
    sociedades: fondo.sociedades || [],
    rendimientos: {
      noventaDias: fondo.rendimientos?.noventaDias ?? null,
      cientoOchentaDias: fondo.rendimientos?.cientoOchentaDias ?? null,
      enElAnio: fondo.rendimientos?.enElAnio ?? null,
      doceMeses: fondo.rendimientos?.doceMeses ?? null,
    },
  })
}

async function resolveLogoUrl(logoUrl, cache) {
  if (!logoUrl) {
    return null
  }

  if (logoUrl.startsWith(`${STATIC_PUBLIC_BASE}${LOGOS_DIRECTORY}/`)) {
    return logoUrl
  }

  if (cache.has(logoUrl)) {
    return cache.get(logoUrl)
  }

  let localized = null

  try {
    const stem = logoFileStemFromUrl(logoUrl)
    const headers = logoUrl.includes('cafci.org.ar')
      ? {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://estadisticas.cafci.org.ar/',
        }
      : undefined

    localized = await descargarImagen(logoUrl, LOGOS_DIRECTORY, stem, {
      headers,
    })
  } catch (error) {
    console.error(`No se pudo localizar logo ${logoUrl}:`, error)
  }

  cache.set(logoUrl, localized || logoUrl)
  return localized || logoUrl
}

function persistirCamposEnSqlite(fondos, dbPath) {
  const db = new Database(dbPath)

  try {
    const select = db.prepare(
      `
        SELECT payload
        FROM current_fund_details
        WHERE class_id = ?
        LIMIT 1
      `,
    )
    const update = db.prepare(
      `
        UPDATE current_fund_details
        SET payload = ?, updated_at = CURRENT_TIMESTAMP
        WHERE class_id = ?
      `,
    )

    const tx = db.transaction(items => {
      for (const fondo of items) {
        if (!fondo.claseId) {
          continue
        }

        const row = select.get(String(fondo.claseId))
        if (!row?.payload) {
          continue
        }

        let payload
        try {
          payload = JSON.parse(row.payload)
        } catch {
          continue
        }

        const next = {
          ...payload,
          benchmark: fondo.benchmark ?? payload.benchmark ?? null,
          duracion: fondo.duracion ?? payload.duracion ?? null,
          horizonte: fondo.horizonte ?? payload.horizonte ?? null,
          region: fondo.region ?? payload.region ?? null,
          composicionCartera:
            fondo.composicionCartera?.length
              ? fondo.composicionCartera
              : payload.composicionCartera || [],
          calificaciones: fondo.calificaciones ?? payload.calificaciones ?? [],
          sociedades: fondo.sociedades ?? payload.sociedades ?? [],
          rendimientos: {
            ...(payload.rendimientos || {}),
            ...(fondo.rendimientos || {}),
          },
        }

        update.run(JSON.stringify(next), String(fondo.claseId))
      }
    })

    tx(fondos)
  } finally {
    db.close()
  }
}
