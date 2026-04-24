import { describe, it, expect } from 'vitest'
import { urlDefuddle } from '@/finanzas/extraccion/defuddle.esjs'

describe('urlDefuddle', () => {
  it('prefija defuddle.md sin protocolo en el path', () => {
    expect(urlDefuddle('https://www.uala.com.ar/inversiones/cuenta-remunerada')).toBe(
      'https://defuddle.md/www.uala.com.ar/inversiones/cuenta-remunerada',
    )
    expect(
      urlDefuddle('https://www.naranjax.com/blog/cual-es-la-tna-de-la-cuenta-remunerada-de-naranja-x'),
    ).toBe(
      'https://defuddle.md/www.naranjax.com/blog/cual-es-la-tna-de-la-cuenta-remunerada-de-naranja-x',
    )
  })
})
