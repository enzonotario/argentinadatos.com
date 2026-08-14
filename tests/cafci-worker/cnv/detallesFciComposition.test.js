import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  matchDetallesFciId,
  normalizeFciName,
} from '../../../apps/cafci-worker/src/cnv/normalizeFciName.js'
import {
  parseCarteraDate,
  parseDetallesFciHtml,
} from '../../../apps/cafci-worker/src/cnv/parseDetallesFciHtml.js'
import { enrichComposicionCarteraFromCnv } from '../../../apps/cafci-worker/src/cnv/enrichComposicionCarteraFromCnv.js'

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/cnv-detalles-fci-87359.html',
)

describe('normalizeFciName / matchDetallesFciId', () => {
  it('normaliza clase, FCI y sufijo Ex', () => {
    expect(normalizeFciName('MP Ahorro - Clase A')).toBe('mp ahorro')
    expect(
      normalizeFciName('ALLARIA AHORRO FCI Ex AL AHORRO FCI'),
    ).toBe('allaria ahorro')
    expect(
      normalizeFciName('Adcap Ahorro Dolares Fondo de Dinero'),
    ).toBe('adcap ahorro dolar')
  })

  it('matchea denominación CNV con nombre de clase', () => {
    const catalog = [
      { Text: 'MP AHORRO', Value: '87359' },
      { Text: 'Mercado Fondo Ex IAM Retorno Total FCI', Value: '63968' },
      { Text: 'Adcap Ahorro Dolares Fondo de Dinero', Value: '63839' },
    ]

    expect(matchDetallesFciId('MP Ahorro - Clase A', catalog)).toMatchObject({
      id: '87359',
    })
    expect(matchDetallesFciId('Mercado Fondo - Clase A', catalog)).toMatchObject(
      {
        id: '63968',
      },
    )
    expect(
      matchDetallesFciId('Adcap Ahorro Dólares - Clase C', catalog),
    ).toMatchObject({ id: '63839' })
  })
})

describe('parseDetallesFciHtml', () => {
  it('extrae fecha y solo activos hoja de la composición vigente', () => {
    const html = readFileSync(fixturePath, 'utf8')
    const parsed = parseDetallesFciHtml(html)

    expect(parseCarteraDate('31/07/26')).toBe('2026-07-31')
    expect(parsed.fondo).toBe('MP Ahorro')
    expect(parsed.fecha).toBe('2026-07-31')
    expect(parsed.tipoRenta).toBe('Renta Fija')
    expect(parsed.horizonte).toBe('Mediano Plazo')
    expect(parsed.composicionCartera.length).toBeGreaterThan(10)

    const categories = parsed.composicionCartera.filter(item =>
      /titulos de deuda|operaciones a plazo|disponibilidades/i.test(item.nombre),
    )
    expect(categories).toHaveLength(0)

    const bono = parsed.composicionCartera.find(
      item => item.nombre === 'Bono Dual TTS26',
    )
    expect(bono).toMatchObject({ porcentaje: 18.57 })
  })
})

describe('enrichComposicionCarteraFromCnv', () => {
  it('aplica la composición a todas las clases del mismo fondoId', async () => {
    const store = new Map([
      [
        '1625:5393',
        {
          fondoId: '1625',
          claseId: '5393',
          slug: 'mp-ahorro-clase-a',
          nombre: 'MP Ahorro - Clase A',
          composicionCartera: [],
        },
      ],
      [
        '1625:5394',
        {
          fondoId: '1625',
          claseId: '5394',
          slug: 'mp-ahorro-clase-b',
          nombre: 'MP Ahorro - Clase B',
          composicionCartera: [],
        },
      ],
    ])

    const repository = {
      getCurrentFunds: () => [...store.values()],
      upsertCurrentFundDetail: payload => {
        store.set(`${payload.fondoId}:${payload.claseId}`, payload)
      },
    }

    const html = readFileSync(fixturePath, 'utf8')
    const stats = await enrichComposicionCarteraFromCnv(repository, {
      catalog: [{ Text: 'MP AHORRO', Value: '87359' }],
      fetchDetalleHtml: async id => {
        expect(id).toBe('87359')
        return html
      },
      concurrency: 1,
      delayMs: 0,
      now: Date.parse('2026-08-14T12:00:00.000Z'),
    })

    expect(stats).toMatchObject({
      matched: 1,
      updated: 1,
      classesUpdated: 2,
    })

    for (const payload of store.values()) {
      expect(payload.detallesFciId).toBe('87359')
      expect(payload.fechaComposicionCartera).toBe('2026-07-31')
      expect(payload.composicionCartera[0]).toMatchObject({
        nombre: 'Bono Dual TTS26',
        porcentaje: 18.57,
      })
    }
  })
})
