import { expect, it } from 'vitest'
import { crawlSenadores } from '../src/senadores/crawlSenadores'

function isActivo(senador: {
  periodoLegal: { inicio: string | null, fin: string | null }
  periodoReal: { inicio: string | null, fin: string | null }
}) {
  const now = new Date()
  const finReal = senador.periodoReal?.fin ? new Date(senador.periodoReal.fin) : null
  if (finReal && finReal <= now) return false
  const finLegal = senador.periodoLegal?.fin ? new Date(senador.periodoLegal.fin) : null
  if (finLegal && finLegal <= now) return false
  const inicio = senador.periodoReal?.inicio || senador.periodoLegal?.inicio || null
  if (inicio && new Date(inicio) > now) return false
  if (!inicio && !finLegal && !finReal) return false
  return true
}

it(
  'crawlSenadores',
  async () => {
    const result = await crawlSenadores()

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(1088)

    const byId = new Map<string, typeof result>()
    for (const senador of result) {
      const list = byId.get(senador.id) || []
      list.push(senador)
      byId.set(senador.id, list)

      expect(senador, `Invalid senator data: ${JSON.stringify(senador)}`).toMatchObject({
        id: expect.any(String),
        nombre: expect.any(String),
        provincia: expect.any(String),
        partido: expect.any(String),
        periodoLegal: {
          inicio: expect.any(String),
          fin: expect.toBeOneOf([null, expect.any(String)]),
        },
        periodoReal: {
          inicio: expect.any(String),
          fin: expect.toBeOneOf([null, expect.any(String)]),
        },
        reemplazo: expect.toBeOneOf([null, expect.any(String)]),
        observaciones: expect.toBeOneOf([null, expect.any(String)]),
        email: expect.toBeOneOf([null, expect.any(String)]),
        telefono: expect.toBeOneOf([null, expect.any(String)]),
        redes: expect.toBeOneOf([null, expect.any(Array)]),
      })
    }

    // Mismo ID con varios mandatos (p.ej. Capitanich reelecto en 2025).
    expect((byId.get('285') || []).length).toBeGreaterThan(1)

    const activos = result.filter(isActivo)
    expect(activos.length).toBe(72)
  },
  {
    timeout: 0,
  },
)
