import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { clearCache, getCached, setCached } from './dynamic/cache.js'
import {
  findDynamicEndpoint,
  getDefaultDynamicEndpoints,
} from './dynamic/registry.js'

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders,
  })
  res.end(JSON.stringify(body))
}

function resolveFilePath(staticDir, urlPath) {
  const root = resolve(staticDir)
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  const relative = decoded.replace(/^\/+/, '')

  const candidates = relative
    ? [relative, join(relative, 'index.json')]
    : ['index.json']

  for (const candidate of candidates) {
    const absolute = resolve(root, candidate)
    if (!absolute.startsWith(root)) continue
    if (existsSync(absolute) && statSync(absolute).isFile()) {
      return absolute
    }
  }

  return null
}

async function handleDynamicEndpoint(endpoint, res) {
  const fresh = getCached(endpoint.cacheKey)
  if (fresh) {
    sendJson(res, 200, fresh, {
      'Cache-Control': `public, max-age=${Math.floor(endpoint.ttlMs / 1000)}`,
      'X-Cache': 'HIT',
    })
    return
  }

  try {
    const data = await endpoint.load()
    setCached(endpoint.cacheKey, data, endpoint.ttlMs)
    sendJson(res, 200, data, {
      'Cache-Control': `public, max-age=${Math.floor(endpoint.ttlMs / 1000)}`,
      'X-Cache': 'MISS',
    })
  } catch (err) {
    console.error('[Server] Dynamic endpoint error:', endpoint.cacheKey, err)
    const stale = getCached(endpoint.cacheKey, { allowStale: true })
    if (stale) {
      sendJson(res, 200, stale, {
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'STALE',
      })
      return
    }
    sendJson(res, 502, {
      error: 'Dynamic endpoint unavailable',
      detail: String(err?.message || err).slice(0, 300),
    })
  }
}

async function handleRequest(staticDir, dynamicEndpoints, req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const url = req.url ?? '/'

  if (url === '/health' || url === '/health/') {
    sendJson(res, 200, { status: 'ok' })
    return
  }

  const dynamic = findDynamicEndpoint(url, dynamicEndpoints)
  if (dynamic) {
    await handleDynamicEndpoint(dynamic, res)
    return
  }

  const filePath = resolveFilePath(staticDir, url)
  if (!filePath) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const ext = filePath.slice(filePath.lastIndexOf('.'))
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
  const body = readFileSync(filePath)

  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60',
  })
  res.end(body)
}

/**
 * @param {string} staticDir
 * @param {number} port
 * @param {{ dynamicEndpoints?: Array }} [options]
 */
export function startStaticServer(staticDir, port, options = {}) {
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true })
  }

  const dynamicEndpoints =
    options.dynamicEndpoints ?? getDefaultDynamicEndpoints()

  const server = createServer((req, res) => {
    handleRequest(staticDir, dynamicEndpoints, req, res).catch(err => {
      console.error('[Server] Request error:', err)
      sendJson(res, 500, { error: 'Internal server error' })
    })
  })

  server.listen(port, () => {
    console.log(`[Server] Serving static API from ${staticDir} on port ${port}`)
  })

  return server
}

export { clearCache }
