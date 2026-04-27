interface Env {
  PROXY_TOKEN: string
  PROXY_ALLOWED_HOSTS?: string
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAuthorized(request, env.PROXY_TOKEN)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    let targetUrl: string | null = request.headers.get('x-target-url')
    let targetMethod =
      request.headers.get('x-target-method')?.toUpperCase() ?? request.method
    let targetHeaders = cloneHeadersWithoutHopByHop(request.headers)
    let targetBody: BodyInit | null = null

    // Nunca reenviar credenciales del proxy al destino.
    targetHeaders.delete('authorization')
    targetHeaders.delete('x-proxy-token')
    targetHeaders.delete('x-target-url')
    targetHeaders.delete('x-target-method')

    if (!targetUrl) {
      if (!request.headers.get('content-type')?.includes('application/json')) {
        return jsonResponse(
          {
            error:
              'Missing x-target-url header or JSON body with { "url": "https://..." }',
          },
          400,
        )
      }

      const payload = (await request.json()) as {
        url?: string
        method?: string
        headers?: Record<string, string>
        body?: string
      }

      targetUrl = payload.url ?? null

      if (payload.method) {
        targetMethod = payload.method.toUpperCase()
      }

      if (payload.headers) {
        targetHeaders = new Headers()
        for (const [key, value] of Object.entries(payload.headers)) {
          if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            targetHeaders.set(key, value)
          }
        }
      }

      if (payload.body && !['GET', 'HEAD'].includes(targetMethod)) {
        targetBody = payload.body
      }
    } else if (!['GET', 'HEAD'].includes(targetMethod)) {
      targetBody = await request.arrayBuffer()
    }

    if (!targetUrl) {
      return jsonResponse({ error: 'Missing target URL' }, 400)
    }

    let url: URL
    try {
      url = new URL(targetUrl)
    } catch {
      return jsonResponse({ error: 'Invalid target URL' }, 400)
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return jsonResponse({ error: 'Only HTTP/S URLs are allowed' }, 400)
    }

    if (!isHostAllowed(url.hostname, env.PROXY_ALLOWED_HOSTS)) {
      return jsonResponse({ error: 'Target host is not allowed' }, 403)
    }

    const upstreamResponse = await fetch(url.toString(), {
      method: targetMethod,
      headers: targetHeaders,
      body: ['GET', 'HEAD'].includes(targetMethod) ? null : targetBody,
      redirect: 'follow',
    })

    const responseHeaders = cloneHeadersWithoutHopByHop(upstreamResponse.headers)

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  },
}

function isAuthorized(request: Request, expectedToken: string): boolean {
  if (!expectedToken) return false

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null
  const tokenHeader = request.headers.get('x-proxy-token')
  const provided = bearerToken ?? tokenHeader

  return provided === expectedToken
}

function isHostAllowed(hostname: string, allowedHostsRaw?: string): boolean {
  if (!allowedHostsRaw || !allowedHostsRaw.trim()) {
    return true
  }

  const allowedHosts = allowedHostsRaw
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean)

  return allowedHosts.includes(hostname.toLowerCase())
}

function cloneHeadersWithoutHopByHop(headers: Headers): Headers {
  const cleanHeaders = new Headers()

  for (const [key, value] of headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      cleanHeaders.set(key, value)
    }
  }

  return cleanHeaders
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
