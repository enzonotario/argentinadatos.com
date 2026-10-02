import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildEscalaSalarial,
  normalizeCategoriaCodigo,
  roundMoney,
} from '../src/senadores/escalaSalarial'
import {
  attachGastoToBloques,
  buildGastoSenado,
  computeGastoPersonal,
} from '../src/senadores/gastoSenado'
import { parseBloquesPersonalHtml } from '../src/senadores/scrapeBloquesPersonal'
import { parseSenadorPersonalHtml } from '../src/senadores/scrapeSenadorPersonal'
import { buildEscalaFromSeed } from '../src/senadores/scrapeEscalaSalarial'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('escala salarial', () => {
  it('normaliza códigos de categoría', () => {
    expect(normalizeCategoriaCodigo('A-1')).toBe('A-1')
    expect(normalizeCategoriaCodigo('a9')).toBe('A-9')
    expect(normalizeCategoriaCodigo('14')).toBe('A-14')
    expect(normalizeCategoriaCodigo('A-15')).toBeNull()
  })

  it('calcula Total + RC desde valor módulo (seed marzo 2026)', () => {
    const escala = buildEscalaFromSeed('2026-10-01T00:00:00.000Z')
    expect(escala.categorias).toHaveLength(14)

    const a1 = escala.categorias[0]
    expect(a1.codigo).toBe('A-1')
    expect(a1.totalModulos).toBe(845)
    // 845 * 2784.456902 ≈ 2_352_866.08
    expect(a1.totalEnPesos).toBeCloseTo(2_352_866.08, 0)
    expect(a1.rc).toBeCloseTo(237_071.45, 0)
    expect(a1.brutoBase).toBeCloseTo(a1.totalEnPesos + a1.rc, 2)
    expect(a1.brutoConAdicionalFuncion).toBeGreaterThan(a1.brutoBase)

    const a14 = escala.categorias[13]
    expect(a14.brutoConAdicionalFuncion).toBe(a14.brutoBase)

    // Dieta: 4000 módulos
    expect(escala.dietaSenador.totalModulos).toBe(4000)
    expect(escala.dietaSenador.brutoEstimado).toBe(
      roundMoney(4000 * escala.valorModulo),
    )
  })

  it('buildEscalaSalarial rechaza módulo inválido', () => {
    expect(() => buildEscalaSalarial({ valorModulo: 0 })).toThrow()
  })
})

describe('parse personal HTML', () => {
  it('parsea bloques con y sin personal', () => {
    const html = readFileSync(
      join(fixtures, 'bloques-agrupados-sample.html'),
      'utf8',
    )
    const bloques = parseBloquesPersonalHtml(html)
    expect(bloques).toHaveLength(2)

    const cf = bloques.find(b => b.id === '95')!
    expect(cf.nombre).toMatch(/Convicción Federal/i)
    expect(cf.personal).toHaveLength(2)
    expect(cf.personal[0]).toMatchObject({
      nombre: 'SERGIO EDGARDO MAMANI',
      categoria: 'A-9',
    })
    expect(cf.senadores.map(s => s.id).sort()).toEqual(['519', '540', '554'])

    const chubut = bloques.find(b => b.id === '94')!
    expect(chubut.personal).toHaveLength(0)
  })

  it('parsea personal de ficha de senador', () => {
    const html = readFileSync(
      join(fixtures, 'senador-personal-sample.html'),
      'utf8',
    )
    const row = parseSenadorPersonalHtml(html, '554')
    expect(row.personal).toHaveLength(2)
    expect(row.personal[0]).toMatchObject({
      nombre: 'FEDERICO MATIAS BLESA',
      categoria: 'A-13',
    })
  })
})

describe('compute gasto', () => {
  it('suma Total+RC por categoría del bloque', () => {
    const escala = buildEscalaFromSeed()
    const html = readFileSync(
      join(fixtures, 'bloques-agrupados-sample.html'),
      'utf8',
    )
    const bloques = attachGastoToBloques(parseBloquesPersonalHtml(html), escala)
    const cf = bloques.find(b => b.id === '95')!

    const a1 = escala.categorias.find(c => c.codigo === 'A-1')!
    const a9 = escala.categorias.find(c => c.codigo === 'A-9')!
    expect(cf.gasto.agentes).toBe(2)
    expect(cf.gasto.brutoMensualEstimado).toBe(
      roundMoney(a1.brutoBase + a9.brutoBase),
    )
    expect(cf.gasto.porCategoria).toHaveLength(2)

    const { gasto } = computeGastoPersonal(
      [{ nombre: 'X', categoria: 'A-99' }],
      escala,
    )
    expect(gasto.sinCategoriaMatch).toBe(1)
    expect(gasto.brutoMensualEstimado).toBe(0)
  })

  it('completa bloque del senador desde el listado de bloques', () => {
    const escala = buildEscalaFromSeed()
    const html = readFileSync(
      join(fixtures, 'bloques-agrupados-sample.html'),
      'utf8',
    )
    const bloques = attachGastoToBloques(parseBloquesPersonalHtml(html), escala)
    const resumen = buildGastoSenado({
      escala,
      bloques,
      senadoresPersonal: [],
      senadores: [
        {
          id: '554',
          nombre: 'Moises, María Carolina',
          bloque: null,
          periodoReal: { fin: null },
        },
      ],
    })
    expect(resumen.senadores[0]?.bloque).toMatch(/Convicción Federal/i)
  })
})
