import { logMensaje } from '@/log.js'

export async function fetchDirectMarkdown(log, url) {
  logMensaje(log, 'Starting direct markdown fetch', {
    url,
  })

  const response = await fetch(url, {
    method: 'GET',
  })

  if (!response.ok) {
    const responseText = await response.text()

    logMensaje(log, 'Direct markdown returned a non-OK response', {
      status: response.status,
      statusText: response.statusText,
      url,
      responseBody: responseText,
    })

    throw new Error(
      `Direct markdown request failed: ${response.status} ${response.statusText}. URL: ${url}`,
    )
  }

  const markdown = await response.text()

  if (!markdown || markdown.trim() === '') {
    throw new Error(`Direct markdown source returned empty content for ${url}`)
  }

  return markdown
}
