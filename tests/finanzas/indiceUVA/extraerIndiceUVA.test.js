import { describe, expect, it } from 'vitest'
import { format, isAfter, subMonths, parse, subDays, isBefore, addDays } from "date-fns";
import { extraerIndiceUVA } from '@/finanzas/extraccion/extraerIndiceUVA.js'

describe('extraerIndiceUVA', () => {
  it('extrae los indices UVA', async () => {
    const items = await extraerIndiceUVA(
      '2023-01-01',
      '2024-01-01'
    )

    expect(items).toMatchSnapshot()
  })

  it('extrae últimos 3 meses', async () => {
    const desde = subMonths(new Date(), 3)
    const hasta = new Date()

    const items = await extraerIndiceUVA(format(desde, 'yyyy-MM-dd'), format(hasta, 'yyyy-MM-dd'))

    expect(items.length).toBeGreaterThan(0)

    for (const item of items) {
      expect(isAfter(parse(item.fecha, 'yyyy-MM-dd', new Date()), subDays(desde, 1))).toBe(true)
      expect(isBefore(parse(item.fecha, 'yyyy-MM-dd', new Date()), addDays(hasta, 1))).toBe(true)
      expect(item.valor).toBeGreaterThan(0)
    }
  })
})
