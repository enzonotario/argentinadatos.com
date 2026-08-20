import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCnvCuotaparteExcel } from '../../../apps/cafci-worker/src/cnv/parseCnvExcel.js'
import {
  computeRendimientosFromHistory,
  mapCnvRowToPayload,
  periodReturnPercent,
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
    expect(mercado.variacionUnMesPct).toBeCloseTo(0.602, 3)
    expect(mercado.variacionEnElAnioPct).toBeCloseTo(13.618, 3)
    expect(mercado.variacionDoceMesesPct).toBeCloseTo(27.617, 3)
  })

  it('expone retornos de período CNV para Fima Acciones', () => {
    const parsed = parseCnvCuotaparteExcel(readFileSync(fixturePath), {
      documentDate: '2026-08-12',
    })

    const fima = parsed.funds.find(
      fund => fund.nombre === 'Fima Acciones - Clase A',
    )

    expect(fima.variacionDiariaPct).toBeCloseTo(-0.747, 3)
    expect(fima.variacionUnMesPct).toBeCloseTo(-8.453, 3)
    expect(fima.variacionEnElAnioPct).toBeCloseTo(-5.025, 3)
    expect(fima.variacionDoceMesesPct).toBeCloseTo(21.673, 3)
  })

  it('prioriza Código de Moneda sobre Moneda Fondo inconsistente', () => {
    const parsed = parseCnvCuotaparteExcel(readFileSync(fixturePath), {
      documentDate: '2026-08-12',
    })

    // code=1 texto=USD → ARS (denominación de la clase, no la cartera)
    for (const clase of ['D', 'E', 'F']) {
      const fund = parsed.funds.find(
        row => row.nombre === `Compass Renta Fija - Clase ${clase}`,
      )
      expect(fund).toMatchObject({
        codigoMoneda: '1',
        moneda: 'Peso Argentino',
      })
    }

    // code=2 texto=USD → USD
    for (const clase of ['A', 'B']) {
      const fund = parsed.funds.find(
        row => row.nombre === `Compass Renta Fija - Clase ${clase}`,
      )
      expect(fund).toMatchObject({
        codigoMoneda: '2',
        moneda: 'Dolar Estadounidense',
      })
    }

    // code=2 texto=ARS → USD (clases dólar de fondo en pesos)
    const crecimientoD = parsed.funds.find(
      row => row.nombre === 'Compass Crecimiento - Clase D',
    )
    expect(crecimientoD).toMatchObject({
      codigoMoneda: '2',
      moneda: 'Dolar Estadounidense',
    })
  })
})

describe('computeRendimientosFromHistory', () => {
  it('prioriza rolling 30D sobre CNV unMes (vs fin de mes previo)', () => {
    const rendimientos = computeRendimientosFromHistory({
      fecha: '2026-08-14',
      valorCuotaparte: 250943.119,
      variacionDiariaPct: -1.514,
      variacionUnMesPct: -9.849,
      variacionEnElAnioPct: -6.474,
      variacionDoceMesesPct: 26.535,
      history: [
        { fecha: '2026-08-07', valorCuotaparte: 255000 },
        { fecha: '2026-07-15', valorCuotaparte: 278000 },
      ],
    })

    expect(rendimientos.variacionDiariaPct).toBeCloseTo(-1.514, 3)
    expect(rendimientos.unMes).toBeCloseTo(
      periodReturnPercent(250943.119, 278000),
      3,
    )
    expect(rendimientos.unMes).not.toBeCloseTo(-9.849, 3)
    expect(rendimientos.enElAnio).toBeCloseTo(-6.474, 3)
    expect(rendimientos.doceMeses).toBeCloseTo(26.535, 3)
    expect(rendimientos.ultimos7Dias).toBeCloseTo(
      periodReturnPercent(250943.119, 255000),
      3,
    )
  })

  it('usa CNV unMes solo si no hay histórico suficiente para 30D', () => {
    const rendimientos = computeRendimientosFromHistory({
      fecha: '2026-08-14',
      valorCuotaparte: 250943.119,
      variacionUnMesPct: -9.849,
      history: [{ fecha: '2026-08-07', valorCuotaparte: 255000 }],
    })

    expect(rendimientos.ultimos7Dias).toBeCloseTo(
      periodReturnPercent(250943.119, 255000),
      3,
    )
    expect(rendimientos.unMes).toBeCloseTo(-9.849, 3)
  })

  it('usa VCP histórico como período (no TNA) cuando faltan columnas CNV', () => {
    const rendimientos = computeRendimientosFromHistory({
      fecha: '2026-08-12',
      valorCuotaparte: 1014.821,
      history: [
        { fecha: '2026-07-01', valorCuotaparte: 1 },
        { fecha: '2026-07-13', valorCuotaparte: 1 },
        { fecha: '2026-07-15', valorCuotaparte: 1001.981 },
        { fecha: '2026-08-05', valorCuotaparte: 1009.672 },
      ],
    })

    expect(rendimientos.ultimos7Dias).toBeCloseTo(
      periodReturnPercent(1014.821, 1009.672),
      3,
    )
    expect(rendimientos.unMes).toBeCloseTo(
      periodReturnPercent(1014.821, 1001.981),
      3,
    )
    expect(Math.abs(rendimientos.unMes)).toBeLessThan(5)
  })

  it('devuelve null en 30D si no hay historia suficiente tras filtrar placeholders', () => {
    const rendimientos = computeRendimientosFromHistory({
      fecha: '2026-08-12',
      valorCuotaparte: 1014.821,
      history: [
        { fecha: '2026-07-13', valorCuotaparte: 1 },
        { fecha: '2026-08-01', valorCuotaparte: 1008 },
        { fecha: '2026-08-05', valorCuotaparte: 1009.672 },
      ],
    })

    expect(rendimientos.ultimos7Dias).toBeTypeOf('number')
    expect(rendimientos.unMes).toBeNull()
  })
})

describe('mapCnvRowToPayload', () => {
  it('mapea una fila CNV al payload normalizado con retornos de período', () => {
    const parsed = parseCnvCuotaparteExcel(readFileSync(fixturePath), {
      documentDate: '2026-08-12',
    })
    const row = parsed.funds.find(
      fund => fund.nombre === 'Fima Acciones - Clase A',
    )

    const payload = mapCnvRowToPayload(row, {
      fondoId: '21',
      history: [{ fecha: '2026-08-05', valorCuotaparte: 258000 }],
    })

    expect(payload.fondoId).toBe('21')
    expect(payload.claseId).toBe(row.claseId)
    expect(payload.nombre).toBe('Fima Acciones - Clase A')
    expect(payload.fecha).toBe('2026-08-12')
    expect(payload.rendimientos.valorCuotaparte).toBeCloseTo(254830.396, 3)
    expect(payload.rendimientos.variacionDiariaPct).toBeCloseTo(-0.747, 3)
    // Sin histórico ~30D, cae al unMes CNV (vs fin de mes previo).
    expect(payload.rendimientos.unMes).toBeCloseTo(-8.453, 3)
    expect(payload.rendimientos.enElAnio).toBeCloseTo(-5.025, 3)
    expect(payload.rendimientos.doceMeses).toBeCloseTo(21.673, 3)
    expect(payload.cantidadCuotapartes).toBeTypeOf('number')
    expect(payload.slug).toContain('fima-acciones')
  })
})
