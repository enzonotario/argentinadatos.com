import { logMensaje } from '@/log.js'

const SCRAPIAR_API_URL =
  import.meta.env.VITE_SCRAPIAR_API_URL || 'https://scrapiar.localhost'
const SCRAPIAR_API_KEY = import.meta.env.VITE_SCRAPIAR_API_KEY
const SCRAPIAR_TIMEOUT_MS = 120_000

/**
 * POSTs `body` to a scrapiar endpoint and returns the parsed JSON response.
 * Non-OK responses are logged (with their body) and thrown.
 *
 * @param {object} log
 * @param {string} path e.g. '/v1/extract/json'
 * @param {{ url: string } & Record<string, unknown>} body
 * @returns {Promise<any>}
 */
export async function requestScrapiar(log, path, body) {
  const response = await fetch(`${SCRAPIAR_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SCRAPIAR_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SCRAPIAR_TIMEOUT_MS),
  })

  if (!response.ok) {
    const responseText = await response.text()

    logMensaje(log, 'scrapiar returned a non-OK response', {
      status: response.status,
      statusText: response.statusText,
      url: body.url,
      responseBody: responseText,
    })

    throw new Error(
      `scrapiar request failed: ${response.status} ${response.statusText}. URL: ${body.url}`,
    )
  }

  return response.json()
}

/**
 * Returns the raw HTML of a page loaded by scrapiar (for pages that block
 * datacenter IPs; scrapiar runs on an Argentine residential IP).
 *
 * @param {object} log
 * @param {string} url
 * @param {{ effort?: 'min' | 'standard' | 'max' }} [options] 'min' uses a plain fetch (falls back to the browser)
 * @returns {Promise<string>}
 */
export async function fetchHtmlWithScrapiar(log, url, { effort = 'min' } = {}) {
  logMensaje(log, 'Starting scrapiar HTML fetch', { url, effort })

  const { html } = await requestScrapiar(log, '/v1/extract/html', {
    url,
    effort,
  })

  if (typeof html !== 'string') {
    throw new Error(`scrapiar returned no HTML. URL: ${url}`)
  }

  logMensaje(log, 'scrapiar HTML fetch succeeded', {
    url,
    htmlLength: html.length,
  })

  return html
}
