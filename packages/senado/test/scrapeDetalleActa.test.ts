import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pdfTieneVotosIndividuales } from '../src/actas/parseVotos.ts'
import {
  mapHtmlVoto,
  normalizeTitulo,
  parseDetalleActaHtml,
  pickRichestTitulo,
  scrapeTituloFromHtml,
} from '../src/actas/scrapeDetalleActa.ts'
import { VotoEnum } from '../src/actas/parseActa.ts'

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('parseDetalleActaHtml', () => {
  it('extrae cabecera y votos desde el HTML de detalleActa/2777', () => {
    const html = readFileSync(join(fixturesDir, 'detalleActa-2777.html'), 'utf8')
    const acta = parseDetalleActaHtml(html, 2777)

    expect(acta.actaId).toBe(2777)
    expect(acta.acta).toBe('6')
    expect(acta.resultado).toBe('afirmativa')
    expect(acta.mayoria).toBe('SIMPLE')
    expect(acta.descripcion).toBe('EN PARTICULAR')
    expect(new Date(acta.fecha).toISOString().startsWith('2005-11-09T')).toBe(true)
    expect(acta.afirmativos).toBe(43)
    expect(acta.negativos).toBe(2)
    expect(acta.abstenciones).toBe(0)
    expect(acta.ausentes).toBe(26)
    expect(acta.presentes).toBe(45)
    expect(acta.miembros).toBe(71)
    expect(acta.votos).toHaveLength(71)
    expect(acta.votos[0]).toEqual({
      nombre: 'SÁNCHEZ, MARÍA DORA',
      voto: VotoEnum.Si,
      banca: '',
    })

    const counts = Object.fromEntries(
      Object.entries(
        acta.votos.reduce((acc, voto) => {
          acc[voto.voto] = (acc[voto.voto] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      ),
    )

    expect(counts).toMatchObject({
      [VotoEnum.Si]: 43,
      [VotoEnum.No]: 2,
      [VotoEnum.Ausente]: 26,
    })
  })
})

describe('mapHtmlVoto', () => {
  it('mapea valores del HTML a VotoEnum', () => {
    expect(mapHtmlVoto('AFIRMATIVO')).toBe(VotoEnum.Si)
    expect(mapHtmlVoto('NEGATIVO')).toBe(VotoEnum.No)
    expect(mapHtmlVoto('AUSENTE')).toBe(VotoEnum.Ausente)
    expect(mapHtmlVoto('ABSTENCIÓN')).toBe(VotoEnum.Abstencion)
  })
})

describe('pdfTieneVotosIndividuales', () => {
  it('detecta PDF diario sin tabla de votos (2777)', async () => {
    expect(
      await pdfTieneVotosIndividuales('/senado/actas/pdf/2777.pdf'),
    ).toBe(false)
  })

  it('detecta PDF Reporting Services con votos (2794)', async () => {
    expect(
      await pdfTieneVotosIndividuales('/senado/actas/pdf/2794.pdf'),
    ).toBe(true)
  })
})

describe('títulos de actas', () => {
  const header = (inner: string) => `
    <div class="row"><div class="col-lg-6 col-sm-6">
      <p>Acta Nro: 23</p>
      <p>${inner}</p>
    </div></div>`

  it('incluye expedientes y O.D. del detalle', () => {
    const html = header(`
      Modernización Laboral. Título XXII.
      <a href="/x">PE-159/25-PL</a> , <a href="/y">O.D. 699/2025  </a>`)
    expect(scrapeTituloFromHtml(html)).toBe(
      'Modernización Laboral. Título XXII. PE-159/25-PL , O.D. 699/2025',
    )
  })

  it('descarta el paréntesis sin cerrar que emite el sitio', () => {
    expect(normalizeTitulo('Tratados. ( O.D. 1/2026 , O.D. 2/2026')).toBe(
      'Tratados. O.D. 1/2026 , O.D. 2/2026',
    )
    expect(normalizeTitulo('( O.D. 477/2026 , O.D. 478/2026')).toBe(
      'O.D. 477/2026 , O.D. 478/2026',
    )
    expect(normalizeTitulo('Art. 4 (bis) O.D. 1/2026')).toBe(
      'Art. 4 (bis) O.D. 1/2026',
    )
  })

  it('pickRichestTitulo nunca pierde expedientes entre corridas', () => {
    const full = 'Modernización Laboral. Título XXII. PE-159/25-PL , O.D. 699/2025'
    const short = 'Modernización Laboral. Título XXII.'
    expect(pickRichestTitulo(short, full)).toBe(full)
    expect(pickRichestTitulo(full, short)).toBe(full)
    expect(pickRichestTitulo('', undefined, short)).toBe(short)
    // Títulos distintos: gana la fuente de mayor prioridad.
    expect(pickRichestTitulo('Nuevo título', 'Otro título más largo')).toBe('Nuevo título')
  })
})
