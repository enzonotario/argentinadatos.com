import { logMensaje } from '@/log.js'

const TABSTACK_API_URL = 'https://api.tabstack.ai/v1/extract/markdown'
const TABSTACK_API_KEY = import.meta.env.VITE_TABSTACK_API_KEY

export async function fetchTabstackMarkdown(log, url) {
  logMensaje(log, 'Starting Tabstack markdown fetch', {
    url,
  })

  const response = await fetch(TABSTACK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${TABSTACK_API_KEY}`,
    },
    body: JSON.stringify({
      geo_target: {
        country: 'AR',
      },
      metadata: false,
      nocache: true,
      url,
    }),
  })

  if (!response.ok) {
    const responseText = await response.text()

    logMensaje(log, 'Tabstack returned a non-OK response', {
      status: response.status,
      statusText: response.statusText,
      url,
      responseBody: responseText,
    })

    throw new Error(
      `Tabstack request failed: ${response.status} ${response.statusText}. URL: ${url}`,
    )
  }

  const payload = await response.json()
  const markdown = payload.content

  if (!markdown) {
    throw new Error(`Tabstack returned empty markdown for URL: ${url}`)
  }

  return markdown
}
