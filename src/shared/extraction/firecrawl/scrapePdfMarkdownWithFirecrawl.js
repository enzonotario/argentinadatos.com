import { getFirecrawlApiUrl, requestFirecrawl } from './firecrawlClient.js'
import { logError, logMensaje } from '@/log.js'

/**
 * Scrape un PDF público a markdown vía Firecrawl.
 * Usa mode `ocr` por defecto (PDFs escaneados / sin capa de texto).
 * Docs: https://docs.firecrawl.dev/features/document-parsing
 * @param {object} log
 * @param {string} url
 * @param {{ mode?: 'fast'|'auto'|'ocr', maxPages?: number, timeoutMs?: number }} [options]
 * @returns {Promise<string>}
 */
export async function scrapePdfMarkdownWithFirecrawl(log, url, options = {}) {
  const mode = options.mode || 'ocr'
  const maxPages = options.maxPages ?? 5
  const timeoutMs = options.timeoutMs ?? 180000

  const requestBody = {
    url,
    onlyMainContent: true,
    maxAge: 0,
    timeout: timeoutMs,
    parsers: [{ type: 'pdf', mode, maxPages }],
    formats: ['markdown'],
  }

  try {
    logMensaje(log, 'Starting Firecrawl PDF scrape', {
      url,
      mode,
      maxPages,
      firecrawlApiUrl: getFirecrawlApiUrl(),
    })

    const response = await requestFirecrawl(requestBody)

    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(
        `Firecrawl PDF request failed: ${response.status} ${response.statusText}. ${responseText}`,
      )
    }

    const payload = await response.json()

    if (!payload.success || !payload.data) {
      throw new Error(`Firecrawl PDF returned success=false for URL: ${url}`)
    }

    const markdown = String(payload.data.markdown || '')
    logMensaje(log, 'Firecrawl PDF scrape succeeded', {
      url,
      markdownLength: markdown.length,
    })
    return markdown
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Firecrawl PDF scrape failed', {
      url,
      errorMessage: error.message,
    })
    throw error
  }
}
