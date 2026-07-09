import { describe, it, expect } from 'vitest'
import { fetchDefuddleMarkdownFromUrl } from '@/shared/extraction/defuddle.js'

describe('fetchDefuddleMarkdownFromUrl', () => {
  it(
    'convierte una página real en markdown',
    async () => {
      const md = await fetchDefuddleMarkdownFromUrl(
        'https://www.bcra.gob.ar/ultimos-informes/',
      )

      expect(typeof md).toBe('string')
      expect(md.length).toBeGreaterThan(100)
      expect(md.toLowerCase()).toContain('informe')
    },
    30000,
  )
})
