import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint'
import { collect } from 'collect.js'
import { expect, it } from 'vitest'
import { crawlActas } from '../src/diputados/actas/crawlActas'

it(
  'crawlActas',
  async () => {
    const currentValues = JSON.parse(readEndpoint('diputados/actas') || '[]')
    const currentIds = new Set(currentValues.map((v: { id: string }) => String(v.id)))

    const result = await crawlActas()

    expect(result).toBeDefined()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)

    const newItems = result.filter(item => !currentIds.has(String(item.id)))
    const toValidate = newItems.length
      ? newItems
      : result.filter(item => Array.isArray(item.votos) && item.votos.length > 0).slice(-5)

    expect(toValidate.length).toBeGreaterThan(0)

    for (const item of toValidate) {
      expect(item).toMatchObject({
        id: expect.any(String),
        periodo: expect.any(String),
        reunion: expect.any(String),
        numeroActa: expect.any(String),
        titulo: expect.any(String),
        resultado: expect.any(String),
        fecha: expect.any(Date),
        presidente: expect.any(String),
        votosAfirmativos: expect.any(Number),
        votosNegativos: expect.any(Number),
        abstenciones: expect.any(Number),
        ausentes: expect.any(Number),
        votos: expect.arrayContaining([
          expect.objectContaining({
            diputado: expect.any(String),
            tipoVoto: expect.toBeOneOf([
              'afirmativo',
              'negativo',
              'abstencion',
              'ausente',
              'presidente',
            ]),
            imagen: expect.any(String),
            videoDiscurso: expect.toBeOneOf([null, expect.any(String)]),
          }),
        ]),
      })
    }

    console.log({
      diffIds: collect(result).pluck('id').diff(currentValues.map((v: { id: string }) => v.id)).all(),
    })
  },
  {
    timeout: 0,
  },
)
