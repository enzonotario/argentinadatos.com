import { loadCaucionesArs, loadCaucionesUsd } from './loaders/cauciones.js'

const DEFAULT_TTL_MS = 15 * 60 * 1000

function resolveTtlMs() {
  const raw = Number(process.env.DYNAMIC_CACHE_TTL_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS
}

/**
 * Normaliza paths de API:
 * - quita query
 * - `/foo/index.json` → `/foo` (rewrite de Cloudflare)
 * - quita trailing slash
 */
export function normalizeApiPath(urlPath) {
  let path = decodeURIComponent((urlPath ?? '/').split('?')[0] ?? '/')
  if (path.endsWith('/index.json')) {
    path = path.slice(0, -'/index.json'.length) || '/'
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  return path
}

/**
 * Registro genérico de endpoints dinámicos (PB + cache).
 * Agregar entradas acá a medida que se migren más paths fuera de JSON estático.
 */
export function getDefaultDynamicEndpoints() {
  const ttlMs = resolveTtlMs()
  return [
    {
      paths: ['/v1/finanzas/cauciones/ars'],
      cacheKey: 'v1/finanzas/cauciones/ars',
      ttlMs,
      load: loadCaucionesArs,
    },
    {
      paths: ['/v1/finanzas/cauciones/usd'],
      cacheKey: 'v1/finanzas/cauciones/usd',
      ttlMs,
      load: loadCaucionesUsd,
    },
  ]
}

export function findDynamicEndpoint(urlPath, endpoints) {
  const path = normalizeApiPath(urlPath)
  return (
    endpoints.find(endpoint =>
      endpoint.paths.some(candidate => normalizeApiPath(candidate) === path),
    ) ?? null
  )
}
