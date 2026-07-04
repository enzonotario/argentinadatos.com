import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
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

function handleRequest(staticDir, req, res) {
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

export function startStaticServer(staticDir, port) {
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true })
  }

  const server = createServer((req, res) => {
    try {
      handleRequest(staticDir, req, res)
    }
    catch (err) {
      console.error('[Server] Request error:', err)
      sendJson(res, 500, { error: 'Internal server error' })
    }
  })

  server.listen(port, () => {
    console.log(`[Server] Serving static API from ${staticDir} on port ${port}`)
  })

  return server
}
