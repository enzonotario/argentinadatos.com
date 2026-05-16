export function construirRequestConProxy(
  urlDestino,
  opciones = {},
  env = import.meta.env,
) {
  const proxyUrl = env.VITE_PROXY_URL
  const proxyToken = env.VITE_PROXY_TOKEN
  const usaProxy = Boolean(proxyUrl && proxyToken)

  const headersNormalizados = normalizarHeaders(opciones.headers)

  if (!usaProxy) {
    return {
      usaProxy: false,
      url: urlDestino,
      opciones: {
        ...opciones,
        headers: headersNormalizados,
      },
    }
  }

  return {
    usaProxy: true,
    url: proxyUrl,
    opciones: {
      ...opciones,
      headers: {
        ...headersNormalizados,
        'x-proxy-token': proxyToken,
        'x-target-url': urlDestino,
      },
    },
  }
}

function normalizarHeaders(headers = {}) {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  return { ...headers }
}
