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
