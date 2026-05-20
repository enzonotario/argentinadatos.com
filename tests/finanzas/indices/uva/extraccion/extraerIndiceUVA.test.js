import { describe, expect, it } from 'vitest'
import {
  format,
  isAfter,
  subMonths,
  parse,
  subDays,
  isBefore,
  addDays,
} from 'date-fns'
import { extraerIndiceUVA } from '@/finanzas/indices/uva/extraccion/extraerIndiceUVA.js'

describe('extraerIndiceUVA', () => {
  it('extrae los indices UVA', async () => {
    const hoy = new Date()

    const items = await extraerIndiceUVA(
      format(subDays(hoy, 7), 'yyyy-MM-dd'),
      format(addDays(hoy, 1), 'yyyy-MM-dd'),
    )

    expect(items[0].fecha).toBeTypeOf('string')
    for (const item of items) {
      expect(
        isAfter(parse(item.fecha, 'yyyy-MM-dd', new Date()), subDays(hoy, 8)),
      ).toBe(true)
      expect(
        isBefore(
          parse(item.fecha, 'yyyy-MM-dd', new Date()),
          addDays(hoy, 2),
        ),
      ).toBe(true)
      expect(item.valor).toBeGreaterThan(0)
    }
  })

  it('extrae últimos 3 meses', async () => {
    const desde = subMonths(new Date(), 3)
    const hasta = new Date()

    const items = await extraerIndiceUVA(
      format(desde, 'yyyy-MM-dd'),
      format(hasta, 'yyyy-MM-dd'),
    )

    expect(items.length).toBeGreaterThan(0)

    for (const item of items) {
      expect(
        isAfter(parse(item.fecha, 'yyyy-MM-dd', new Date()), subDays(desde, 1)),
      ).toBe(true)
      expect(
        isBefore(
          parse(item.fecha, 'yyyy-MM-dd', new Date()),
          addDays(hasta, 1),
        ),
      ).toBe(true)
      expect(item.valor).toBeGreaterThan(0)
    }
  })
})
