import { logError, logMensaje } from '@/log.js'
import { buildFirecrawlRequest } from './buildFirecrawlRequest.js'
import { getFirecrawlApiUrl, requestFirecrawl } from './firecrawlClient.js'

function assertValidFirecrawlPayload(payload, pageUrl) {
  if (!payload.success) {
    throw new Error(`Firecrawl returned success=false for URL: ${pageUrl}`)
  }

  if (!payload.data || !payload.data.json) {
    throw new Error(
      `Firecrawl response is missing data.json for URL: ${pageUrl}`,
    )
  }

  return payload.data.json
}

export async function scrapeWithFirecrawl(log, extractionConfig) {
  const { url } = extractionConfig
  const requestBody = buildFirecrawlRequest(extractionConfig)

  try {
    logMensaje(log, 'Starting Firecrawl request', {
      url,
      firecrawlApiUrl: getFirecrawlApiUrl(),
    })

    const response = await requestFirecrawl(requestBody)

    if (!response.ok) {
      const responseText = await response.text()

      logMensaje(log, 'Firecrawl returned a non-OK response', {
        status: response.status,
        statusText: response.statusText,
        url,
        firecrawlApiUrl: getFirecrawlApiUrl(),
        responseBody: responseText,
        requestBody,
      })

      throw new Error(
        `Firecrawl request failed: ${response.status} ${response.statusText}. URL: ${url}`,
      )
    }

    const payload = await response.json()
    const data = assertValidFirecrawlPayload(payload, url)

    logMensaje(log, 'Firecrawl request succeeded', {
      url,
      hasData: payload?.data?.json !== null,
    })

    return data
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Firecrawl scraping failed', {
      url,
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      firecrawlApiUrl: getFirecrawlApiUrl(),
      extractionConfig: {
        url,
        hasPrompt: !!extractionConfig.prompt,
        hasSchema: !!extractionConfig.schema,
        required: extractionConfig.required,
      },
    })
    throw error
  }
}
