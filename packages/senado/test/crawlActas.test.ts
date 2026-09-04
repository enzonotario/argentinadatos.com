import { expect, it } from 'vitest'
import * as cheerio from 'cheerio'
import {
  collectListedActas,
  crawlActas,
} from '../src/actas/crawlActas'

it(
  'crawlActas',
  async () => {
    const year = new Date().getFullYear()
    const listing = await fetch('https://www.senado.gob.ar/votaciones/actas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `busqueda_actas%5Banio%5D=${year}&busqueda_actas%5Btitulo%5D=&x=42&y=8`,
    })
    const $ = cheerio.load(await listing.text())
    const listed = collectListedActas($, $('table#actasTable tbody tr'))
    expect(listed.length).toBeGreaterThan(0)
    const listedIds = new Set(listed.map(row => row.id))
    const listedMax = Math.max(...listedIds)

    const result = await crawlActas({ year })

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)

    const resultIds = new Set(
      result.map(a => a.actaId).filter((id): id is number => Number.isFinite(id)),
    )
    expect(Math.max(...resultIds)).toBeGreaterThanOrEqual(listedMax)

    // Todas las del listado oficial deben haber sido extraídas.
    const missing = [...listedIds].filter(id => !resultIds.has(id))
    expect(missing).toEqual([])

    for (const acta of result) {
      expect(acta).toMatchObject({
        actaId: expect.any(Number),
        titulo: expect.any(String),
        proyecto: expect.any(String),
        descripcion: expect.any(String),
        quorumTipo: expect.any(String),
        fecha: expect.any(String),
        acta: expect.any(String),
        mayoria: expect.any(String),
        miembros: expect.any(Number),
        afirmativos: expect.any(Number),
        negativos: expect.any(Number),
        abstenciones: expect.any(Number),
        presentes: expect.any(Number),
        ausentes: expect.any(Number),
        amn: expect.any(Number),
        resultado: expect.any(String),
        votos: expect.any(Array),
        observaciones: expect.any(Array),
      })
    }
  },
  {
    timeout: 0,
  },
)
