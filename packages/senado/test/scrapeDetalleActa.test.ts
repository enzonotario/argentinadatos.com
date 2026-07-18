import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pdfTieneVotosIndividuales } from '../src/actas/parseVotos.ts'
import {
  mapHtmlVoto,
  parseDetalleActaHtml,
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
