import { loadCauciones } from './loaders/cauciones.js'

const DEFAULT_TTL_MS = 15 * 60 * 1000

function resolveTtlMs() {
  const raw = Number(process.env.DYNAMIC_CACHE_TTL_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS
}

/**
 * Registro genérico de endpoints dinámicos (PB + cache).
 * Agregar entradas acá a medida que se migren más paths fuera de JSON estático.
 */
export function getDefaultDynamicEndpoints() {
  const ttlMs = resolveTtlMs()
  return [
    {
      paths: ['/v1/finanzas/cauciones', '/v1/finanzas/cauciones/'],
      cacheKey: 'v1/finanzas/cauciones',
      ttlMs,
      load: loadCauciones,
    },
  ]
}

export function findDynamicEndpoint(urlPath, endpoints) {
  const path = decodeURIComponent((urlPath ?? '/').split('?')[0] ?? '/')
  return endpoints.find(endpoint => endpoint.paths.includes(path)) ?? null
}
