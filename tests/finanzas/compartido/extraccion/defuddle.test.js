import { describe, it, expect } from 'vitest'
import { convertHtmlToMarkdownWithDefuddle } from '@/shared/extraction/defuddle.js'

describe('convertHtmlToMarkdownWithDefuddle', () => {
  it('convierte HTML mínimo en markdown', async () => {
    const html =
      '<html><head><title>T</title></head><body><article><h1>Hello</h1><p>World</p></article></body></html>'
    const md = await convertHtmlToMarkdownWithDefuddle(
      html,
      'https://example.com/pagina',
    )
    expect(md).toContain('Hello')
    expect(md).toContain('World')
  })
})
