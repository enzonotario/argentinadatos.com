import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  applyBancasToDiputados,
  assignDiputadoIds,
  bancaByDiputadoId,
  matchRecintoToDiputadoId,
  normalizeRecintoRows,
  parseRecintoHtml,
} from '../src/diputados/diputados/scrapeRecinto.ts'

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'fixtures/recintoweb.html'),
  'utf8',
)

describe('parseRecintoHtml', () => {
  it('lee bancas embebidas en recintoweb', () => {
    const raw = parseRecintoHtml(fixture)
    expect(raw.length).toBeGreaterThan(200)
    expect(raw[0]).toHaveProperty('BANCA')
    expect(raw[0]).toHaveProperty('APELLIDO_ALIAS')
  })
})

describe('normalize + match', () => {
  const raw = parseRecintoHtml(fixture)
  const rows = normalizeRecintoRows(raw)

  it('normaliza banca numérica y nombres', () => {
    expect(rows.length).toBe(257)
    const menem = rows.find(r => r.apellido === 'Menem')
    expect(menem?.banca).toBe(0)
    expect(menem?.bloque).toMatch(/LIBERTAD/i)
  })

  it('detecta banca vacante 223', () => {
    const occupied = new Set(rows.map(r => r.banca))
    expect(occupied.has(223)).toBe(false)
  })

  it('matchea a id HCDN por apellido+nombre+distrito', () => {
    const catalog = [
      {
        id: 'HCDN-ROSSI',
        apellido: 'Rossi',
        nombre: 'Agustín Oscar',
        provincia: 'Santa Fe',
        periodoMandato: { inicio: '2025-12-10', fin: '2029-12-09' },
      },
      {
        id: 'HCDN-MENEM',
        apellido: 'Menem',
        nombre: 'Martín',
        provincia: 'La Rioja',
        periodoMandato: { inicio: '2023-12-10', fin: '2027-12-09' },
      },
    ]
    const rossi = rows.find(r => r.apellido === 'Rossi')!
    expect(matchRecintoToDiputadoId(rossi, catalog)).toBe('HCDN-ROSSI')
    const menem = rows.find(r => r.apellido === 'Menem')!
    expect(matchRecintoToDiputadoId(menem, catalog)).toBe('HCDN-MENEM')
  })

  it('en colisión de banca 0 prefiere quien tiene bloque', () => {
    const asientos = assignDiputadoIds(
      [
        {
          banca: 0,
          idAutoridad: '1',
          cuil: '1',
          apellido: 'Giordano',
          nombre: 'Juan Carlos',
          distrito: 'BUENOS AIRES',
          bloque: null,
          bloqueColor: null,
          interbloque: null,
          interbloqueColor: null,
          mandato: null,
          mandatoFin: null,
          estado: 'ACTIVO',
        },
        {
          banca: 0,
          idAutoridad: '2',
          cuil: '2',
          apellido: 'Menem',
          nombre: 'Martín',
          distrito: 'LA RIOJA',
          bloque: 'LA LIBERTAD AVANZA',
          bloqueColor: '#976DBA',
          interbloque: null,
          interbloqueColor: null,
          mandato: null,
          mandatoFin: null,
          estado: 'ACTIVO',
        },
      ],
      [
        {
          id: 'HCDN-G',
          apellido: 'Giordano',
          nombre: 'Juan Carlos',
          provincia: 'Buenos Aires',
          periodoMandato: { inicio: '2023-12-10', fin: '2027-12-09' },
        },
        {
          id: 'HCDN-M',
          apellido: 'Menem',
          nombre: 'Martín',
          provincia: 'La Rioja',
          periodoMandato: { inicio: '2023-12-10', fin: '2027-12-09' },
        },
      ],
    )
    const map = bancaByDiputadoId(asientos)
    expect(map['HCDN-M']).toBe(0)
    expect(map['HCDN-G']).toBeUndefined()
  })

  it('applyBancasToDiputados agrega campo banca', () => {
    const enriched = applyBancasToDiputados(
      [
        {
          id: 'HCDN1',
          nombre: 'A',
          apellido: 'B',
          genero: 'M',
          provincia: 'X',
          periodoMandato: { inicio: null, fin: null },
          juramentoFecha: '',
          ceseFecha: '',
          bloque: 'Z',
          periodoBloque: { inicio: null, fin: null },
          foto: null,
        },
      ],
      { HCDN1: 42 },
    )
    expect(enriched[0]?.banca).toBe(42)
  })
})
