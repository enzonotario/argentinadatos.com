import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/log.js', () => ({
  logMensaje: vi.fn(),
  logError: vi.fn(),
}))

const log = {}

const schema = {
  tasa: { type: 'number' },
  tope: { type: 'number' },
}

async function importarExtractWithAI() {
  vi.resetModules()
  const { extractWithAI } =
    await import('@/shared/extraction/ai/extractWithAI.js')
  return extractWithAI
}

function respuestaJson(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('extractWithAI (scrapiar)', () => {
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

  it('envía el request a scrapiar y devuelve el objeto extraído', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ tasa: 0.02, tope: 10000 }))
    const extractWithAI = await importarExtractWithAI()

    const datos = await extractWithAI(log, {
      url: 'https://example.com',
      prompt: 'Extrae la tasa',
      schema,
    })

    expect(datos).toEqual({ tasa: 0.02, tope: 10000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://scrapiar.test/v1/extract/json')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk_test',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body)).toEqual({
      url: 'https://example.com',
      prompt: 'Extrae la tasa',
      json_schema: {
        type: 'object',
        properties: schema,
        required: ['tasa', 'tope'],
      },
      effort: 'standard',
    })
  })

  it('respeta required y effort cuando se indican', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ tasa: 0.02, tope: null }))
    const extractWithAI = await importarExtractWithAI()

    await extractWithAI(log, {
      url: 'https://example.com',
      prompt: 'Extrae la tasa',
      schema,
      required: ['tasa'],
      effort: 'min',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.json_schema.required).toEqual(['tasa'])
    expect(body.effort).toBe('min')
  })

  it('usa la URL por defecto si no hay VITE_SCRAPIAR_API_URL', async () => {
    vi.stubEnv('VITE_SCRAPIAR_API_URL', '')
    fetchMock.mockResolvedValue(respuestaJson({ tasa: 0.02 }))
    const extractWithAI = await importarExtractWithAI()

    await extractWithAI(log, { url: 'https://example.com', schema })

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://scrapiar.localhost/v1/extract/json',
    )
  })

  it('lanza un error si scrapiar responde con error', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
        { error: 'upstream failed' },
        { status: 502, statusText: 'Bad Gateway' },
      ),
    )
    const extractWithAI = await importarExtractWithAI()

    await expect(
      extractWithAI(log, { url: 'https://example.com', schema }),
    ).rejects.toThrow(
      'scrapiar request failed: 502 Bad Gateway. URL: https://example.com',
    )
  })
})
