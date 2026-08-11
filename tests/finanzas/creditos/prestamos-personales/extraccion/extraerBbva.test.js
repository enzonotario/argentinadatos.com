import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parsearBbva,
  parsearBbvaPdf,
  puntosATramosBbva,
  resolverUrlPdfBbva,
} from '@/finanzas/creditos/prestamos-personales/extraccion/extraerBbva.js'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')

describe('extraerBbva', () => {
  it('resuelve el link del PDF de tasas', () => {
    const html = readFileSync(join(fixturesDir, 'bbva.html'), 'utf8')
    expect(resolverUrlPdfBbva(html)).toContain('tasaprestpers.pdf')
  })

  it('extrae TNA, TEA y CFTEA del HTML (fallback)', () => {
    const html = readFileSync(join(fixturesDir, 'bbva.html'), 'utf8')
    const ofertas = parsearBbva(html)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'BBVA',
      tna: 1.29,
      tea: 2.4051,
      cftTea: 3.23,
      requiereCliente: true,
      vigenciaDesde: '2026-08-01',
      vigenciaHasta: '2026-08-31',
    })
  })

  it('convierte plazos puntuales en tramos contiguos', () => {
    expect(
      puntosATramosBbva([
        { plazoMeses: 6, tna: 1.29, tea: 2.4051, cftTea: 3.2008 },
        { plazoMeses: 12, tna: 1.29, tea: 2.4051, cftTea: 3.2172 },
      ]),
    ).toEqual([
      {
        plazoMinMeses: 1,
        plazoMaxMeses: 6,
        tna: 1.29,
        tea: 2.4051,
        cftTea: 3.2008,
      },
      {
        plazoMinMeses: 7,
        plazoMaxMeses: 12,
        tna: 1.29,
        tea: 2.4051,
        cftTea: 3.2172,
      },
    ])
  })

  it('parsea tabla por plazo del PDF', () => {
    const texto = readFileSync(join(fixturesDir, 'bbva.pdf.txt'), 'utf8')
    const ofertas = parsearBbvaPdf(texto)

    expect(ofertas).toHaveLength(1)
    expect(ofertas[0]).toMatchObject({
      entidad: 'BBVA',
      tna: 1.29,
      tea: 2.4051,
      cftTea: 3.23,
      requiereCliente: true,
      vigenciaDesde: '2026-08-01',
      vigenciaHasta: '2026-08-30',
      metadata: {
        fuentePdf: true,
        plazoMesesEjemplo: 72,
        plazoMinMeses: 1,
        plazoMaxMeses: 72,
      },
    })
    expect(ofertas[0].metadata.tasasPorPlazo).toHaveLength(7)
    expect(ofertas[0].metadata.tasasPorPlazo[0]).toMatchObject({
      plazoMinMeses: 1,
      plazoMaxMeses: 6,
      tna: 1.29,
      cftTea: 3.2008,
    })
    expect(ofertas[0].metadata.tasasPorPlazo[6]).toMatchObject({
      plazoMinMeses: 61,
      plazoMaxMeses: 72,
      cftTea: 3.23,
    })
  })
})
