import axios from 'axios'
import { getProxyConfig } from '../config.js'

const cafciBaseUrl = 'https://estadisticas.cafci.org.ar'
const cafciUserAgent =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'

function buildCafciHeaders(extraHeaders = {}) {
  return {
    'User-Agent': cafciUserAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua':
      '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    Referer: `${cafciBaseUrl}/resultado-busqueda?tipoRentaId=&regionId=&benchmarkId=`,
    ...extraHeaders,
  }
}

function buildCafciRequest(url, options = {}) {
  const { proxyUrl, proxyToken, usesProxy } = getProxyConfig()
  const headers = buildCafciHeaders(options.headers)

  if (usesProxy) {
    return {
      url: proxyUrl,
      options: {
        ...options,
        headers: {
          ...headers,
          'x-proxy-token': proxyToken,
          'x-target-url': url,
        },
      },
      usesProxy: true,
      targetUrl: url,
    }
  }

  return {
    url,
    options: {
      ...options,
      headers,
    },
    usesProxy: false,
    targetUrl: url,
  }
}

function formatCafciHttpError(error, targetUrl, usesProxy) {
  const status = error.response?.status
  const statusText = error.response?.statusText
  const statusLabel = status
    ? `${status} ${statusText ?? ''}`.trim()
    : 'network'

  let hint = ''

  if (status === 403) {
    hint = usesProxy
      ? ' CloudFront bloqueó el request incluso via proxy.'
      : ' CloudFront bloqueó el request desde este servidor. Configurá CAFCI_WORKER_PROXY_URL y CAFCI_WORKER_PROXY_TOKEN (o VITE_PROXY_URL y VITE_PROXY_TOKEN).'
  }

  return new Error(
    `CAFCI request failed (${statusLabel}): ${targetUrl}.${hint}`,
    {
      cause: error,
    },
  )
}

export async function cafciGet(url, options = {}) {
  const request = buildCafciRequest(url, options)

  try {
    return await axios.get(request.url, request.options)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw formatCafciHttpError(error, request.targetUrl, request.usesProxy)
    }

    throw error
  }
}
