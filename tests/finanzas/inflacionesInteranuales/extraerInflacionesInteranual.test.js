import { describe, expect, it } from 'vitest'
import { extraerInflacionesInteranual } from '@/finanzas/extraccion/extraerInflacionesInteranual.js'

describe('extraerInflacionesInteranual', () => {
  it('extrae los inflaciones interanuales', async () => {
    const inflaciones = await extraerInflacionesInteranual('2000-01-01', '2023-12-31')

    expect(inflaciones).toMatchSnapshot()
  })
})
