import { describe, expect, it } from 'vitest'
import {
  parsearRendimientoPrex,
  parsearTasaPrex,
} from '@/finanzas/rendimientos/extraerPrex.js'

function htmlConNextData(usdRate) {
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    { props: { pageProps: { usdRate } } },
  )}</script></body></html>`
}

describe('parsearTasaPrex', () => {
  it('parsea porcentajes con coma y punto', () => {
    expect(parsearTasaPrex('2%')).toBe(2)
    expect(parsearTasaPrex('2,00%')).toBe(2)
    expect(parsearTasaPrex('2.5%')).toBe(2.5)
  })

  it('devuelve null para valores inválidos', () => {
    expect(parsearTasaPrex(undefined)).toBeNull()
    expect(parsearTasaPrex('sin tasa')).toBeNull()
    expect(parsearTasaPrex('-1%')).toBeNull()
  })
})

describe('parsearRendimientoPrex', () => {
  it('lee la tasa desde __NEXT_DATA__', () => {
    expect(parsearRendimientoPrex(htmlConNextData('2%'))).toBe(2)
  })

  it('usa el texto visible como fallback', () => {
    const html =
      '<html><body><p>Con una tasa anual del 3,50%* para tus dólares</p></body></html>'

    expect(parsearRendimientoPrex(html)).toBe(3.5)
  })

  it('devuelve null si no encuentra la tasa', () => {
    expect(
      parsearRendimientoPrex('<html><body><p>Hola</p></body></html>'),
    ).toBeNull()
  })
})
