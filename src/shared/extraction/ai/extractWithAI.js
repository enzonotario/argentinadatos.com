import { logError, logMensaje } from '@/log.js'
import { extractStructuredDataWithOpenAI } from './openaiJsonExtractor.js'
import { createMarkdownSource } from './markdown-sources/createMarkdownSource.js'

export async function extractWithAI(log, extractionConfig) {
  const {
    url,
    prompt,
    schema,
    required,
    markdown,
    markdownSource = 'tabstack',
  } = extractionConfig

  try {
    let resolvedMarkdown = markdown

    if (!resolvedMarkdown) {
      const markdownProvider = createMarkdownSource(markdownSource)
      resolvedMarkdown = await markdownProvider(log, url)
    }

    return extractStructuredDataWithOpenAI(log, {
      markdown: resolvedMarkdown,
      prompt,
      schema,
      required,
      url,
    })
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'AI extraction failed', {
      url,
      errorMessage: error.message,
    })
    throw error
  }
}
