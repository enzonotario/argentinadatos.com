import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { hasFirecrawlCredentials } from '../src/senadores/firecrawlClient'
import {
  applyDietasMecanismosMeta,
  claveApellidoNombre,
  foldNombre,
  matchDietaRowToSenadorNombre,
  scrapeDietasMecanismos,
} from '../src/senadores/scrapeDietasMecanismos'

const puedeFirecrawl = hasFirecrawlCredentials()

describe('match dieta nombres', () => {
  it('fold y clave ignoran tildes / 2º nombre', () => {
    expect(foldNombre('BULLRICH, PATRICIA')).toBe('bullrich, patricia')
    expect(claveApellidoNombre('Monteverde, Agustín Aníbal')).toBe(
      'monteverde|agustin',
    )
    expect(
      matchDietaRowToSenadorNombre(
        'MONTEVERDE, AGUSTÍN ANÍBAL',
        'Monteverde, Agustín Aníbal',
      ),
    ).toBe(true)
  })
})

describe('applyDietasMecanismosMeta', () => {
  it('escribe meta.dieta y no pisa otras claves de meta', () => {
    const senadores = [
      {
        id: '1',
        nombre: 'Arce, Carlos Omar',
        meta: {
          personal: { agentes: 2 },
          dietaEstimada: { brutoEstimado: 1 },
        },
      },
      {
        id: '2',
        nombre: 'Otro, Sin Match',
        meta: null,
      },
    ]
    const { matchedIds, unmatchedRows } = applyDietasMecanismosMeta(
      senadores as any,
      {
        fuente: 'https://example.com/mecanismos.pdf',
        scrapedAt: '2026-01-01T00:00:00.000Z',
        senadores: [
          {
            nombre: 'ARCE, CARLOS OMAR',
            provincia: 'MISIONES',
            renunciaAlAumento: true,
            donacion: false,
            aportesPartidarios: false,
          },
        ],
      },
    )

    expect(matchedIds).toEqual(['1'])
    expect(unmatchedRows).toHaveLength(0)
    expect(senadores[0].meta).toMatchObject({
      personal: { agentes: 2 },
      dietaEstimada: { brutoEstimado: 1 },
      dieta: {
        renunciaAlAumento: true,
        donacion: false,
        aportesPartidarios: false,
        fuente: 'https://example.com/mecanismos.pdf',
      },
    })
    expect(senadores[1].meta).toBeNull()
  })
})

describe.skipIf(!puedeFirecrawl)('scrapeDietasMecanismos (Firecrawl real)', () => {
  it(
    'scrapea el PDF, cachea ~72 filas y aplica meta a senadores vigentes',
    async () => {
      // Una sola llamada real a Firecrawl (force) para validar el pipeline.
      const cache = await scrapeDietasMecanismos({ force: true })

      expect(cache.fuente).toContain('mecanismos.pdf')
      expect(cache.senadores.length).toBeGreaterThanOrEqual(70)
      expect(cache.senadores.length).toBeLessThanOrEqual(80)

      const arce = cache.senadores.find(s =>
        foldNombre(s.nombre).startsWith('arce, carlos'),
      )
      expect(arce).toMatchObject({
        renunciaAlAumento: true,
        donacion: false,
      })

      const bullrich = cache.senadores.find(s =>
        foldNombre(s.nombre).startsWith('bullrich, patricia'),
      )
      expect(bullrich).toMatchObject({
        donacion: true,
      })

      const persisted = readEndpoint('/senado/senadores/dietas-mecanismos')
      expect(persisted).toBeTruthy()
      expect(JSON.parse(persisted!).senadores.length).toBe(cache.senadores.length)

      const senadoresRaw = readEndpoint('/senado/senadores')
      expect(senadoresRaw).toBeTruthy()
      const senadores = JSON.parse(senadoresRaw!) as Array<{
        id: string
        nombre: string
        meta?: { dieta?: unknown } | null
      }>

      const { matchedIds, unmatchedRows } = applyDietasMecanismosMeta(
        senadores,
        cache,
      )

      expect(matchedIds.length).toBeGreaterThanOrEqual(65)
      expect(unmatchedRows.length).toBeLessThanOrEqual(5)

      const monteverde = senadores.find(
        s => s.id === '581' && s.meta?.dieta,
      )
      expect(monteverde?.meta?.dieta).toMatchObject({
        renunciaAlAumento: expect.any(Boolean),
        donacion: expect.any(Boolean),
        aportesPartidarios: expect.any(Boolean),
        fuente: expect.stringContaining('mecanismos.pdf'),
      })

      const conDieta = senadores.filter(s => s.meta?.dieta)
      expect(conDieta.length).toBeGreaterThanOrEqual(65)
    },
    180_000,
  )
})
