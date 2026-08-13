import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCnvCuotaparteExcel } from '../../../apps/cafci-worker/src/cnv/parseCnvExcel.js'
import {
  annualizeReturnPercent,
  computeRendimientosFromHistory,
  mapCnvRowToPayload,
} from '../../../apps/cafci-worker/src/cnv/mapCnvRowToPayload.js'

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/cnv-20260812.xlsx',
)

describe('parseCnvCuotaparteExcel', () => {
  it('parsea la planilla diaria y filtra por fecha del documento', () => {
    const parsed = parseCnvCuotaparteExcel(readFileSync(fixturePath), {
      documentDate: '2026-08-12',
    })

    expect(parsed.funds.length).toBeGreaterThan(1000)

    const mercado = parsed.funds.find(
      fund => fund.nombre === 'Mercado Fondo - Clase A',
    )

    expect(mercado).toMatchObject({
      claseId: '1982',
      codigoCNV: '956',
      fecha: '2026-08-12',
      tipoRenta: 'Mercado de Dinero',
      moneda: 'Peso Argentino',
    })
    expect(mercado.valorCuotaparte).toBeCloseTo(25166.651, 3)
    expect(mercado.variacionDiariaPct).toBeCloseTo(0.05, 2)
  })
})

describe('computeRendimientosFromHistory', () => {
  it('anualiza retornos 7d/30d al estilo CAFCI', () => {
    const rendimientos = computeRendimientosFromHistory({
      fecha: '2026-08-12',
      valorCuotaparte: 25166.651,
      variacionDiariaPct: 0.05,
      history: [
        { fecha: '2026-08-05', valorCuotaparte: 25078.748 },
        { fecha: '2026-07-13', valorCuotaparte: 24700 },
      ],
    })

    expect(rendimientos.ultimos7Dias).toBeCloseTo(18.2766, 1)
    expect(rendimientos.unMes).toBeTypeOf('number')
    expect(rendimientos.valorCuotaparte).toBe(25166.651)
  })

  it('annualizeReturnPercent calcula TNA simple', () => {
    expect(annualizeReturnPercent(101, 100, 1)).toBeCloseTo(365, 0)
  })
})

describe('mapCnvRowToPayload', () => {
  it('mapea una fila CNV al payload normalizado', () => {
    const parsed = parseCnvCuotaparteExcel(readFileSync(fixturePath), {
      documentDate: '2026-08-12',
    })
    const row = parsed.funds.find(
      fund => fund.nombre === 'Mercado Fondo - Clase A',
    )

    const payload = mapCnvRowToPayload(row, {
      fondoId: '798',
      history: [{ fecha: '2026-08-05', valorCuotaparte: 25078.748 }],
    })

    expect(payload.fondoId).toBe('798')
    expect(payload.claseId).toBe('1982')
    expect(payload.nombre).toBe('Mercado Fondo - Clase A')
    expect(payload.fecha).toBe('2026-08-12')
    expect(payload.rendimientos.valorCuotaparte).toBeCloseTo(25166.651, 3)
    expect(payload.rendimientos.ultimos7Dias).toBeGreaterThan(10)
    expect(payload.cantidadCuotapartes).toBeTypeOf('number')
    expect(payload.slug).toContain('mercado-fondo')
  })
})
