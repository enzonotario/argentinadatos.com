import axios from 'axios'

const cafciBaseUrl = 'https://estadisticas.cafci.org.ar'
const cafciUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function buildCafciHeaders(extraHeaders = {}) {
  return {
    'User-Agent': cafciUserAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    Referer: `${cafciBaseUrl}/`,
    ...extraHeaders,
  }
}

function formatCafciHttpError(error, targetUrl) {
  const status = error.response?.status
  const statusText = error.response?.statusText
  const statusLabel = status
    ? `${status} ${statusText ?? ''}`.trim()
    : 'network'

  const hint =
    status === 403 ? ' CloudFront bloqueó el request. Probá desde otra IP.' : ''

  return new Error(
    `CAFCI request failed (${statusLabel}): ${targetUrl}.${hint}`,
    {
      cause: error,
    },
  )
}

export async function cafciGet(url, options = {}) {
  try {
    return await axios.get(url, {
      ...options,
      headers: buildCafciHeaders(options.headers),
    })
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw formatCafciHttpError(error, url)
    }

    throw error
  }
}
