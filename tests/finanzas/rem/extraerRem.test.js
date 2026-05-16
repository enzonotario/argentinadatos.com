import { describe, expect, it } from 'vitest'
import {
  extraerRem,
  obtenerUrlXlsxDesdeHtml,
  obtenerUrlsPublicacionesRemDesdeHtmlUltimosInformes,
  parsearNumero,
  resolverUrl,
  parsearPeriodo,
} from '@/finanzas/rem/extraccion/extraerRem.js'

const URLS_REM_2026 = [
  'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-rem-marzo-de-2026/',
  'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-febrero-de-2026/',
]

describe('extraerRem', () => {
  it('descubre las últimas publicaciones REM desde últimos informes', () => {
    const html = `
      <table>
        <tr><td><a href="https://www.bcra.gob.ar/publicaciones/informe-monetario-mensual-marzo-de-2026/">Informe Monetario Mensual</a></td></tr>
        <tr><td><a href="https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-rem-marzo-de-2026/">Relevamiento de Expectativas de Mercado (REM)</a></td></tr>
        <tr><td><a href="/publicaciones/relevamiento-de-expectativas-de-mercado-febrero-de-2026/">Relevamiento de Expectativas de Mercado (REM)</a></td></tr>
      </table>
    `

    expect(obtenerUrlsPublicacionesRemDesdeHtmlUltimosInformes(html)).toEqual([
      'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-rem-marzo-de-2026/',
      'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-febrero-de-2026/',
    ])
  })

  it('normaliza enlaces heredados de sitiopublico.desa.bcra.net', () => {
    expect(
      resolverUrl(
        'https://sitiopublico.desa.bcra.net/Pdfs/PublicacionesEstadisticas/tablas-relevamiento-expectativas-mercado-ago-2025.xlsx',
      ),
    ).toBe(
      'https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/tablas-relevamiento-expectativas-mercado-ago-2025.xlsx',
    )
  })

  it('encuentra XLSX aunque el enlace venga con atributos distintos', () => {
    const html =
      '<a href="/archivos/Pdfs/PublicacionesEstadisticas/informes/tablas-relevamiento-expectativas-mercado-mar-2026.xlsx" target="_blank">XLSX</a>'

    expect(
      obtenerUrlXlsxDesdeHtml(
        html,
        'https://www.bcra.gob.ar/publicaciones/test/',
      ),
    ).toBe(
      'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/tablas-relevamiento-expectativas-mercado-mar-2026.xlsx',
    )
  })

  it('normaliza números con decimales y separadores de miles', () => {
    expect(parsearNumero('3.0')).toBe(3)
    expect(parsearNumero('1,420')).toBe(1420)
    expect(parsearNumero('93,235')).toBe(93235)
    expect(parsearNumero('2,5')).toBe(2.5)
  })

  it('normaliza períodos mensuales, trimestrales y anuales', () => {
    expect(parsearPeriodo('Mar-26')).toEqual({
      tipo: 'mensual',
      desde: '2026-03-01',
      hasta: '2026-03-31',
    })
    expect(parsearPeriodo('Trim. II-26')).toEqual({
      tipo: 'trimestral',
      desde: '2026-04-01',
      hasta: '2026-06-30',
    })
    expect(parsearPeriodo('2026')).toEqual({
      tipo: 'anual',
      desde: '2026-01-01',
      hasta: '2026-12-31',
    })
  })

  it('extrae todas las tablas de los XLSX del REM', async () => {
    const items = await extraerRem(URLS_REM_2026)

    expect(items.length).toBeGreaterThan(250)

    const marzoIpc = items.find(
      item =>
        item.informe === '2026-03' &&
        item.muestra === 'todos' &&
        item.indicador ===
          'Precios minoristas (IPC nivel general-Nacional; INDEC)' &&
        item.periodo === 'Mar-26',
    )

    expect(marzoIpc).toMatchObject({
      fecha: '2026-03-01',
      periodoTipo: 'mensual',
      periodoDesde: '2026-03-01',
      periodoHasta: '2026-03-31',
      referencia: 'var. % mensual',
      unidad: 'var. % mensual',
      mediana: 3,
      promedio: 3,
      participantes: 46,
    })

    const marzoTipoCambio = items.find(
      item =>
        item.informe === '2026-03' &&
        item.indicador === 'Tipo de cambio nominal' &&
        item.periodo === 'Apr-26' &&
        item.muestra === 'todos',
    )

    expect(marzoTipoCambio.mediana).toBe(1420)
    expect(marzoTipoCambio.unidad).toBe('$/USD')

    expect(items.some(item => item.informe === '2026-02')).toBe(true)
    expect(items.some(item => item.muestra === 'top_10')).toBe(true)
  }, 30000)
})
