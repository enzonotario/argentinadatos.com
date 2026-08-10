import { getFirecrawlApiUrl, requestFirecrawl } from './firecrawlClient.js'
import { logError, logMensaje } from '@/log.js'

/**
 * Scrape HTML/markdown con Firecrawl (sin extracción AI).
 * @returns {Promise<{ markdown: string, html: string }>}
 */
export async function scrapeHtmlWithFirecrawl(log, url) {
  const requestBody = {
    url,
    onlyMainContent: true,
    maxAge: 0,
    formats: ['markdown', 'html'],
  }

  try {
    logMensaje(log, 'Starting Firecrawl HTML scrape', {
      url,
      firecrawlApiUrl: getFirecrawlApiUrl(),
    })

    const response = await requestFirecrawl(requestBody)

    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(
        `Firecrawl request failed: ${response.status} ${response.statusText}. ${responseText}`,
      )
    }

    const payload = await response.json()

    if (!payload.success || !payload.data) {
      throw new Error(`Firecrawl returned success=false for URL: ${url}`)
    }

    const markdown = payload.data.markdown || ''
    const html = payload.data.html || ''

    logMensaje(log, 'Firecrawl HTML scrape succeeded', {
      url,
      markdownLength: markdown.length,
      htmlLength: html.length,
    })

    return { markdown, html }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Firecrawl HTML scrape failed', {
      url,
      errorMessage: error.message,
    })
    throw error
  }
}
