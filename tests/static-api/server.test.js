import { get } from 'node:http'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clearCache, startStaticServer } from '../../apps/static-api/server.js'

const TEST_DIR = join(tmpdir(), `argentinadatos-server-test-${Date.now()}`)

function fetchText(port, path) {
  return new Promise((resolve, reject) => {
    get(`http://127.0.0.1:${port}${path}`, res => {
      let body = ''
      const headers = res.headers
      res.on('data', chunk => {
        body += chunk
      })
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body, headers }),
      )
    }).on('error', reject)
  })
}

describe('static api server', () => {
  const port = 19000 + Math.floor(Math.random() * 1000)
  let server
  let loadCount = 0

  beforeAll(async () => {
    mkdirSync(join(TEST_DIR, 'v1', 'cotizaciones', 'dolares'), {
      recursive: true,
    })
    writeFileSync(
      join(TEST_DIR, 'v1', 'cotizaciones', 'dolares', 'index.json'),
      '{"ok":true}',
    )
    mkdirSync(join(TEST_DIR, 'static', 'logos'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'static', 'logos', 'test.svg'), '<svg></svg>')

    clearCache()
    server = startStaticServer(TEST_DIR, port, {
      dynamicEndpoints: [
        {
          paths: ['/v1/finanzas/cauciones', '/v1/finanzas/cauciones/'],
          cacheKey: 'test-cauciones',
          ttlMs: 60_000,
          load: async () => {
            loadCount += 1
            return {
              titulos: [
                {
                  plazo: 1,
                  montoContado: 100,
                  tasaPromedio: 20,
                  fechaVencimiento: '2026-08-22T00:00:00',
                },
              ],
            }
          },
        },
      ],
    })
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(() => {
    server?.close()
    rmSync(TEST_DIR, { recursive: true, force: true })
    clearCache()
  })

  it('serves /health', async () => {
    const { status, body } = await fetchText(port, '/health')
    expect(status).toBe(200)
    expect(JSON.parse(body)).toEqual({ status: 'ok' })
  })

  it('resolves api paths to index.json', async () => {
    const { status, body } = await fetchText(port, '/v1/cotizaciones/dolares')
    expect(status).toBe(200)
    expect(JSON.parse(body)).toEqual({ ok: true })
  })

  it('serves static assets', async () => {
    const { status, body } = await fetchText(port, '/static/logos/test.svg')
    expect(status).toBe(200)
    expect(body).toBe('<svg></svg>')
  })

  it('returns 404 for missing paths', async () => {
    const { status } = await fetchText(port, '/missing')
    expect(status).toBe(404)
  })

  it('serves dynamic cauciones and caches the loader', async () => {
    loadCount = 0
    clearCache()

    const first = await fetchText(port, '/v1/finanzas/cauciones')
    expect(first.status).toBe(200)
    expect(JSON.parse(first.body).titulos).toHaveLength(1)
    expect(first.headers['x-cache']).toBe('MISS')
    expect(loadCount).toBe(1)

    const second = await fetchText(port, '/v1/finanzas/cauciones/')
    expect(second.status).toBe(200)
    expect(second.headers['x-cache']).toBe('HIT')
    expect(loadCount).toBe(1)

    // Cloudflare rewrite: /v1/... → /v1/.../index.json
    const rewritten = await fetchText(port, '/v1/finanzas/cauciones/index.json')
    expect(rewritten.status).toBe(200)
    expect(rewritten.headers['x-cache']).toBe('HIT')
    expect(loadCount).toBe(1)
  })
})
