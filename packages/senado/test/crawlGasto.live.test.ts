import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { crawlGastoSenado } from '../src/senadores/gastoSenado'

/**
 * Crawl real de escala + bloques + personal de despachos.
 * Escribe JSON en datos/v1/senado/*.
 */
describe('crawlGastoSenado (red)', () => {
  it(
    'scrapea y persiste escala, bloques, personal y gasto',
    async () => {
      const senadores = JSON.parse(readEndpoint('/senado/senadores') || '[]') as Array<{
        id: string
        nombre: string
        bloque?: string | null
        periodoReal?: { fin?: string | null } | null
        meta?: { dieta?: { renunciaAlAumento?: boolean } | null } | null
      }>

      const { escala, bloques, senadoresPersonal, gasto } = await crawlGastoSenado({
        senadores,
      })

      expect(escala.categorias).toHaveLength(14)
      expect(escala.valorModulo).toBeGreaterThan(1000)
      expect(bloques.length).toBeGreaterThanOrEqual(10)

      const conPersonal = bloques.filter(b => b.gasto.agentes > 0)
      expect(conPersonal.length).toBeGreaterThan(0)

      expect(senadoresPersonal.length).toBeGreaterThan(50)
      const despachoConPersonal = senadoresPersonal.filter(p => p.gasto.agentes > 0)
      expect(despachoConPersonal.length).toBeGreaterThan(10)

      expect(gasto.totales.bloquesPersonalBruto).toBeGreaterThan(0)
      expect(gasto.totales.despachosPersonalBruto).toBeGreaterThan(0)
      expect(gasto.totales.dietasSenadoresBruto).toBeGreaterThan(0)

      expect(readEndpoint('/senado/escala-salarial')).toBeTruthy()
      expect(readEndpoint('/senado/bloques')).toBeTruthy()
      expect(readEndpoint('/senado/gasto')).toBeTruthy()
    },
    300_000,
  )
})
