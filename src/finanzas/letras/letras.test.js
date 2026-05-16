import { describe, expect, it } from 'vitest'
import {
  calcularVpv,
  dias360,
  extraerLetras,
  extraerLetrasDesdeSheets,
  extraerTem,
  parsearFilaSheets,
  parsearVencimientoTicker,
  aFechaIso,
} from './extraccion/extraerLetras.js'

describe('parsearVencimientoTicker', () => {
  it('parsea LECAP S31G5 → 2025-08-31', () => {
    expect(parsearVencimientoTicker('S31G5')).toBe('2025-08-31')
  })

  it('parsea BONCAP T17O5 → 2025-10-17', () => {
    expect(parsearVencimientoTicker('T17O5')).toBe('2025-10-17')
  })

  it('parsea enero con código E', () => {
    expect(parsearVencimientoTicker('S16E6')).toBe('2026-01-16')
  })

  it('retorna undefined para ticker corto', () => {
    expect(parsearVencimientoTicker('S1G')).toBeUndefined()
  })

  it('retorna undefined para tipo inválido', () => {
    expect(parsearVencimientoTicker('X31G5')).toBeUndefined()
  })

  it('retorna undefined para mes inválido', () => {
    expect(parsearVencimientoTicker('S31Z5')).toBeUndefined()
  })
})

describe('dias360', () => {
  it('calcula 30 días entre meses consecutivos', () => {
    expect(dias360('2024-01-01', '2024-02-01')).toBe(30)
  })

  it('calcula 360 días entre años consecutivos', () => {
    expect(dias360('2024-01-01', '2025-01-01')).toBe(360)
  })

  it('maneja día 31 como 30 (30/360)', () => {
    const d = dias360('2024-01-31', '2024-02-29')
    expect(d).toBe(29)
  })

  it('cuando day1=30, limita day2 a 30', () => {
    expect(dias360('2024-01-30', '2024-02-31')).toBe(30)
  })

  it('retorna 0 para misma fecha', () => {
    expect(dias360('2024-06-14', '2024-06-14')).toBe(0)
  })
})

describe('calcularVpv', () => {
  it('retorna 100 para vencimiento igual a emisión', () => {
    expect(calcularVpv('2024-01-01', '2024-01-01', 3.5)).toBeCloseTo(100, 4)
  })

  it('crece con el tiempo al 3.5% TEM a 12 meses', () => {
    const vpv = calcularVpv('2024-01-01', '2025-01-01', 3.5)
    expect(vpv).toBeGreaterThan(100)
    expect(vpv).toBeLessThan(200)
  })

  it('mayor TEM produce mayor VPV', () => {
    const vpv1 = calcularVpv('2024-01-01', '2025-01-01', 2.0)
    const vpv2 = calcularVpv('2024-01-01', '2025-01-01', 3.5)
    expect(vpv2).toBeGreaterThan(vpv1)
  })

  it('calcula VPV correcto para 30 días a 3% TEM', () => {
    const vpv = calcularVpv('2024-01-01', '2024-02-01', 3.0)
    expect(vpv).toBeCloseTo(103, 0)
  })
})

describe('extraerTem', () => {
  it('extrae TEM de texto con coma decimal', () => {
    expect(extraerTem('capitalizable 3,75%')).toBeCloseTo(3.75)
  })

  it('extrae TEM de texto con punto decimal', () => {
    expect(extraerTem('capitalizable 2.5%')).toBeCloseTo(2.5)
  })

  it('retorna null para texto sin TEM', () => {
    expect(extraerTem('Tasa fija anual')).toBeNull()
  })

  it('retorna null para valor nulo', () => {
    expect(extraerTem(null)).toBeNull()
  })
})

describe('aFechaIso', () => {
  it('parsea DD/MM/YYYY', () => {
    expect(aFechaIso('31/08/2025')).toBe('2025-08-31')
  })

  it('parsea M/D/YY (formato xlsx)', () => {
    expect(aFechaIso('8/31/25')).toBe('2025-08-31')
  })

  it('pasa fecha ISO sin cambios', () => {
    expect(aFechaIso('2025-08-31')).toBe('2025-08-31')
  })

  it('parsea instancia de Date', () => {
    expect(aFechaIso(new Date('2025-08-31T00:00:00.000Z'))).toBe('2025-08-31')
  })

  it('retorna null para null', () => {
    expect(aFechaIso(null)).toBeNull()
  })

  it('retorna null para string vacío', () => {
    expect(aFechaIso('')).toBeNull()
  })
})

describe('parsearFilaSheets', () => {
  it('parsea fila completa respetando vpv del sheet', () => {
    const result = parsearFilaSheets([
      'S17A6',
      '2025-12-15',
      '2026-04-17',
      '2.4',
      '110',
    ])
    expect(result).toEqual({
      ticker: 'S17A6',
      fechaEmision: '2025-12-15',
      fechaVencimiento: '2026-04-17',
      tem: 2.4,
      vpv: 110,
    })
  })

  it('deriva fechaVencimiento del ticker cuando está vacía y calcula vpv', () => {
    const result = parsearFilaSheets(['S17A6', '2025-12-15', '', '2.4', ''])
    expect(result.ticker).toBe('S17A6')
    expect(result.fechaEmision).toBe('2025-12-15')
    expect(result.fechaVencimiento).toBe('2026-04-17')
    expect(result.tem).toBeCloseTo(2.4)
    expect(result.vpv).toBeGreaterThan(100)
  })

  it('calcula vpv cuando no está definido pero sí tem y fechas', () => {
    const result = parsearFilaSheets([
      'S17A6',
      '2025-12-15',
      '2026-04-17',
      '2.4',
      '',
    ])
    expect(result.vpv).not.toBeNull()
    expect(result.vpv).toBeGreaterThan(100)
  })

  it('no sobreescribe vpv del sheet con el calculado', () => {
    const result = parsearFilaSheets([
      'S17A6',
      '2025-12-15',
      '2026-04-17',
      '2.4',
      '110',
    ])
    const calculado = calcularVpv('2025-12-15', '2026-04-17', 2.4)
    expect(result.vpv).toBe(110)
    expect(result.vpv).not.toBeCloseTo(calculado)
  })

  it('fila con solo ticker y vpv devuelve lo que puede', () => {
    const result = parsearFilaSheets(['S17A6', '', '', '', '110'])
    expect(result.ticker).toBe('S17A6')
    expect(result.vpv).toBe(110)
    expect(result.fechaEmision).toBeNull()
    expect(result.tem).toBeNull()
    expect(result.fechaVencimiento).toBe('2026-04-17') // derivada del ticker
  })

  it('fila con ticker, fechaEmision y tem calcula fechaVencimiento y vpv', () => {
    // ticker S30A6 → vencimiento 2026-04-30
    const result = parsearFilaSheets(['S30A6', '2025-09-30', '', '3.53', ''])
    expect(result.fechaVencimiento).toBe('2026-04-30')
    expect(result.vpv).toBeGreaterThan(100)
  })

  it('retorna null para fila sin ticker', () => {
    expect(
      parsearFilaSheets(['', '2025-12-15', '2026-04-17', '2.4', '110']),
    ).toBeNull()
  })

  it('retorna null para fila vacía', () => {
    expect(parsearFilaSheets([])).toBeNull()
  })

  it('parsea BONCAP T30J6 correctamente', () => {
    const result = parsearFilaSheets([
      'T30J6',
      '2025-01-17',
      '2026-06-30',
      '2.15',
      '145',
    ])
    expect(result.ticker).toBe('T30J6')
    expect(result.fechaVencimiento).toBe('2026-06-30')
    expect(result.tem).toBeCloseTo(2.15)
    expect(result.vpv).toBe(145)
  })
})

describe('extraerLetrasDesdeSheets (integración)', () => {
  it(
    'obtiene datos del Google Sheet de letras',
    { timeout: 30000 },
    async () => {
      const datos = await extraerLetrasDesdeSheets()

      expect(Array.isArray(datos)).toBe(true)

      if (datos.length > 0) {
        for (const item of datos) {
          expect(item.ticker).toMatch(/^[ST]\d{2}[EFMAYLGJSOND]\d/)
          expect(item.vpv).not.toBeNull()
          expect(typeof item.vpv).toBe('number')
          expect(item.vpv).toBeGreaterThan(100)
        }
      }
    },
  )
})

describe('extraerLetras (integración)', () => {
  it(
    'obtiene datos reales de LECAPs y BONCAPs desde fuentes oficiales',
    { timeout: 60000 },
    async () => {
      const datos = await extraerLetras()

      expect(Array.isArray(datos)).toBe(true)

      if (datos.length > 0) {
        for (const item of datos) {
          expect(item.ticker).toMatch(/^[ST]\d{2}[EFMAYLGJSOND]\d/)
          expect(item.fechaEmision).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(item.fechaVencimiento).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(typeof item.tem).toBe('number')
          expect(item.tem).toBeGreaterThan(0)
          expect(item.vpv).toBeGreaterThan(100)
          expect(item.fechaEmision <= item.fechaVencimiento).toBe(true)
        }
      }
    },
  )
})
