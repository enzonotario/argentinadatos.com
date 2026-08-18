import { describe, expect, it } from 'vitest'
import {
  matchNominaToDiputadoId,
  parseNominaHtml,
  scrapeNominaHcdn,
} from '../src/diputados/diputados/scrapeNominaFotos.ts'

const NOMINA_HTML = `
<table id="tablaDiputados">
  <tbody>
    <tr>
      <td><img src="https://parlamentaria.hcdn.gob.ar/image/1_1_small.png" alt=""></td>
      <td><a href="/diputados/haguirre/">Aguirre, Hilda</a></td>
      <td>La Pampa</td>
    </tr>
    <tr>
      <td><img src="https://parlamentaria.hcdn.gob.ar/image/2_1_small.png" alt=""></td>
      <td><a href="/diputados/eali/">Ali, Ernesto "Pipi"</a></td>
      <td>Buenos Aires</td>
    </tr>
    <tr>
      <td><img src="https://parlamentaria.hcdn.gob.ar/image/3_1_small.png" alt=""></td>
      <td><a href="/diputados/jschiaretti/">Schiaretti, Juan</a></td>
      <td>Córdoba</td>
    </tr>
  </tbody>
</table>
`

describe('parseNominaHtml', () => {
  it('lee retratos y prefiere _medium', () => {
    const rows = parseNominaHtml(NOMINA_HTML)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      nombre: 'Aguirre, Hilda',
      slug: 'haguirre',
      provincia: 'La Pampa',
      fotoUrl: 'https://parlamentaria.hcdn.gob.ar/image/1_1_medium.png',
    })
    expect(rows[1]?.nombre).toBe('Ali, Ernesto "Pipi"')
  })
})

describe('matchNominaToDiputadoId', () => {
  const catalog = [
    {
      id: 'HCDN1',
      apellido: 'Aguirre',
      nombre: 'Hilda',
      provincia: 'La Pampa',
      periodoMandato: { inicio: '2023-12-10', fin: '2027-12-09' },
    },
    {
      id: 'HCDN2',
      apellido: 'Ali',
      nombre: 'Ernesto Pipi',
      provincia: 'Buenos Aires',
      periodoMandato: { inicio: '2025-12-10', fin: '2029-12-09' },
    },
    {
      id: 'HCDN-OLD',
      apellido: 'Schiaretti',
      nombre: 'Juan',
      provincia: 'Córdoba',
      periodoMandato: { inicio: '2011-12-10', fin: '2015-12-09' },
    },
    {
      id: 'HCDN-NOW',
      apellido: 'Schiaretti',
      nombre: 'Juan',
      provincia: 'Córdoba',
      periodoMandato: { inicio: '2025-12-10', fin: '2029-12-09' },
    },
  ]

  it('matchea apellido, nombre', () => {
    expect(matchNominaToDiputadoId({
      nombre: 'Aguirre, Hilda',
      slug: 'haguirre',
      provincia: 'La Pampa',
      fotoUrl: 'x',
    }, catalog)).toBe('HCDN1')
  })

  it('matchea apodos tipo Pipi', () => {
    expect(matchNominaToDiputadoId({
      nombre: 'Ali, Ernesto "Pipi"',
      slug: 'eali',
      provincia: 'Buenos Aires',
      fotoUrl: 'x',
    }, catalog)).toBe('HCDN2')
  })

  it('si hay dos ids, prefiere mandato vigente', () => {
    expect(matchNominaToDiputadoId({
      nombre: 'Schiaretti, Juan',
      slug: 'jschiaretti',
      provincia: 'Córdoba',
      fotoUrl: 'x',
    }, catalog)).toBe('HCDN-NOW')
  })

  it('no matchea desconocidos', () => {
    expect(matchNominaToDiputadoId({
      nombre: 'Nadie, Foo',
      slug: null,
      provincia: 'Salta',
      fotoUrl: 'x',
    }, catalog)).toBeNull()
  })
})

describe('scrapeNominaHcdn (red)', () => {
  it('parsea retratos de la nómina actual', { timeout: 30_000 }, async () => {
    const rows = await scrapeNominaHcdn()
    expect(rows.length).toBeGreaterThan(200)
    expect(rows[0]?.fotoUrl).toMatch(/parlamentaria\.hcdn\.gob\.ar\/image\/.+_medium\.png/)
    expect(rows[0]?.nombre).toMatch(/,/)
  })
})
