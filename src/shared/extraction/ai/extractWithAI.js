import { logError, logMensaje } from '@/log.js'
import { requestScrapiar } from '@/shared/extraction/scrapiar.js'

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

    const result = await requestScrapiar(log, '/v1/extract/json', {
      url,
      prompt,
      json_schema: {
        type: 'object',
        properties: schema,
        required: required ?? Object.keys(schema),
      },
      effort,
    })

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
