import { logError, logMensaje } from '@/log.js'

const SCRAPIAR_API_URL =
  import.meta.env.VITE_SCRAPIAR_API_URL || 'https://scrapiar.localhost'
const SCRAPIAR_API_KEY = import.meta.env.VITE_SCRAPIAR_API_KEY
const SCRAPIAR_TIMEOUT_MS = 120_000

/**
 * Extracts structured data from a URL using scrapiar, which renders the page,
 * converts it to markdown and runs the LLM extraction.
 *
 * Fields not listed in `required` are returned as nullable. When `required`
 * is omitted, every field in `schema` is required.
 *
 * @param {object} log
 * @param {object} extractionConfig
 * @param {string} extractionConfig.url
 * @param {string} [extractionConfig.prompt]
 * @param {Record<string, object>} extractionConfig.schema JSON schema properties
 * @param {string[]} [extractionConfig.required]
 * @param {'min' | 'standard' | 'max'} [extractionConfig.effort] 'min' uses a plain fetch (no browser)
 */
export async function extractWithAI(log, extractionConfig) {
  const {
    url,
    prompt,
    schema,
    required,
    effort = 'standard',
  } = extractionConfig

  try {
    logMensaje(log, 'Starting scrapiar extraction', {
      url,
      effort,
    })

    const response = await fetch(`${SCRAPIAR_API_URL}/v1/extract/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCRAPIAR_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        prompt,
        json_schema: {
          type: 'object',
          properties: schema,
          required: required ?? Object.keys(schema),
        },
        effort,
      }),
      signal: AbortSignal.timeout(SCRAPIAR_TIMEOUT_MS),
    })

    if (!response.ok) {
      const responseText = await response.text()

      logMensaje(log, 'scrapiar returned a non-OK response', {
        status: response.status,
        statusText: response.statusText,
        url,
        responseBody: responseText,
      })

      throw new Error(
        `scrapiar request failed: ${response.status} ${response.statusText}. URL: ${url}`,
      )
    }

    const result = await response.json()

    logMensaje(log, 'scrapiar extraction succeeded', {
      url,
      data: result,
    })

    return result
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'AI extraction failed', {
      url,
      errorMessage: error.message,
    })
    throw error
  }
}
