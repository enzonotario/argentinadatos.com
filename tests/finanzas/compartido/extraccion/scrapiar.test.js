import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/log.js', () => ({
  logMensaje: vi.fn(),
  logError: vi.fn(),
}))

const log = {}

async function importarScrapiar() {
  vi.resetModules()
  return import('@/shared/extraction/scrapiar.js')
}

function respuestaJson(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('scrapiar client', () => {
  let fetchMock

  beforeEach(() => {
    vi.stubEnv('VITE_SCRAPIAR_API_KEY', 'sk_test')
    vi.stubEnv('VITE_SCRAPIAR_API_URL', 'https://scrapiar.test')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('requestScrapiar', () => {
    it('hace POST autenticado al path indicado y devuelve el JSON', async () => {
      fetchMock.mockResolvedValue(respuestaJson({ ok: true }))
      const { requestScrapiar } = await importarScrapiar()

      const resultado = await requestScrapiar(log, '/v1/extract/markdown', {
        url: 'https://example.com',
      })

      expect(resultado).toEqual({ ok: true })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://scrapiar.test/v1/extract/markdown')
      expect(init.method).toBe('POST')
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk_test',
      })
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(JSON.parse(init.body)).toEqual({ url: 'https://example.com' })
    })

    it('lanza un error si scrapiar responde con error', async () => {
      fetchMock.mockResolvedValue(
        respuestaJson(
          { error: 'Target responded with HTTP 403' },
          { status: 424, statusText: 'Failed Dependency' },
        ),
      )
      const { requestScrapiar } = await importarScrapiar()

      await expect(
        requestScrapiar(log, '/v1/extract/html', {
          url: 'https://example.com',
        }),
      ).rejects.toThrow(
        'scrapiar request failed: 424 Failed Dependency. URL: https://example.com',
      )
    })
  })

  describe('fetchHtmlWithScrapiar', () => {
    it('pide /v1/extract/html con effort min por defecto y devuelve el html', async () => {
      fetchMock.mockResolvedValue(
        respuestaJson({
          url: 'https://example.com',
          html: '<html><body>hola</body></html>',
        }),
      )
      const { fetchHtmlWithScrapiar } = await importarScrapiar()

      const html = await fetchHtmlWithScrapiar(log, 'https://example.com')

      expect(html).toBe('<html><body>hola</body></html>')
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://scrapiar.test/v1/extract/html')
      expect(JSON.parse(init.body)).toEqual({
        url: 'https://example.com',
        effort: 'min',
      })
    })

    it('respeta el effort indicado', async () => {
      fetchMock.mockResolvedValue(
        respuestaJson({ url: 'https://example.com', html: '<html></html>' }),
      )
      const { fetchHtmlWithScrapiar } = await importarScrapiar()

      await fetchHtmlWithScrapiar(log, 'https://example.com', {
        effort: 'standard',
      })

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).effort).toBe(
        'standard',
      )
    })

    it('lanza un error si scrapiar responde con error', async () => {
      fetchMock.mockResolvedValue(
        respuestaJson(
          { error: 'Blocked by a bot challenge' },
          { status: 424, statusText: 'Failed Dependency' },
        ),
      )
      const { fetchHtmlWithScrapiar } = await importarScrapiar()

      await expect(
        fetchHtmlWithScrapiar(log, 'https://example.com'),
      ).rejects.toThrow('scrapiar request failed: 424 Failed Dependency')
    })

    it('lanza un error si la respuesta no trae html', async () => {
      fetchMock.mockResolvedValue(respuestaJson({ url: 'https://example.com' }))
      const { fetchHtmlWithScrapiar } = await importarScrapiar()

      await expect(
        fetchHtmlWithScrapiar(log, 'https://example.com'),
      ).rejects.toThrow('scrapiar returned no HTML')
    })
  })
})
