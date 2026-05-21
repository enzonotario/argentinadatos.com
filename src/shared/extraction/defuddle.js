import { Defuddle } from 'defuddle/node'

/**
 * Converts HTML into markdown using the Defuddle package.
 * @see https://defuddle.md/docs
 */
export async function convertHtmlToMarkdownWithDefuddle(html, pageUrl) {
  if (!html || html.trim() === '') {
    throw new Error('Empty HTML received for Defuddle')
  }

  const result = await Defuddle(html, pageUrl, {
    markdown: true,
  })

  const markdown = result.content

  if (!markdown || markdown.trim() === '') {
    throw new Error(`Defuddle returned empty markdown for ${pageUrl}`)
  }

  return markdown
}

export async function fetchDefuddleMarkdownFromUrl(pageUrl) {
  const response = await fetch(pageUrl, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(
      `Error fetching HTML for Defuddle: ${response.status} ${response.statusText}. URL: ${pageUrl}`,
    )
  }

  const html = await response.text()

  return convertHtmlToMarkdownWithDefuddle(html, pageUrl)
}
