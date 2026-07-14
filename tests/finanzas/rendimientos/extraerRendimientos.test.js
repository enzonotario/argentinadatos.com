
import { describe, expect, it } from 'vitest'
import { extraerNexo } from '@/finanzas/rendimientos/extraerNexo.js'
import { extraerFiwind } from '@/finanzas/rendimientos/extraerFiwind.js'
import { extraerLetsbit } from '@/finanzas/rendimientos/extraerLetsbit.js'
import { extraerBelo } from '@/finanzas/rendimientos/extraerBelo.js'
import { extraerLemoncash } from '@/finanzas/rendimientos/extraerLemoncash.js'
import { extraerRipio } from '@/finanzas/rendimientos/extraerRipio.js'
import { extraerSatoshiTango } from '@/finanzas/rendimientos/extraerSatoshiTango.js'
import { extraerLucaMoney } from '@/finanzas/rendimientos/extraerLucaMoney.js'
import { extraerDecrypto } from '@/finanzas/rendimientos/extraerDecrypto.js'
import { extraerVesseo } from '@/finanzas/rendimientos/extraerVesseo.js'
import { extraerAstroPay } from '@/finanzas/rendimientos/extraerAstroPay.js'
import { extraerLunefi } from '@/finanzas/rendimientos/extraerLunefi.js'
import { extraerBerry } from '@/finanzas/rendimientos/extraerBerry.js'

function testItems(items) {
  expect(items.length).toBeGreaterThan(0)

  for (const item of items) {
    expect(item.moneda).toBeTypeOf('string')
    expect(item.apy).toBeTypeOf('number')
    expect(item.fecha).toBeTypeOf('string')
  }
}

describe('extraerRendimientos', () => {
  it('guarda nexo', async () => {
    const items = await extraerNexo()

    testItems(items)
  })

  it('guarda fiwind', async () => {
    const items = await extraerFiwind()

    testItems(items)
  })

  it('guarda letsbit', async () => {
    const items = await extraerLetsbit()

    testItems(items)
  })

  it('guarda belo', async () => {
    const items = await extraerBelo()

    testItems(items)
  })

  it('guarda lemoncash', async () => {
    const items = await extraerLemoncash()

    testItems(items)
  })

  it('guarda ripio', async () => {
    const items = await extraerRipio()

    testItems(items)
  })

  it('guarda satoshitango', async () => {
    const items = await extraerSatoshiTango()

    testItems(items)
  })

  it('guarda lucamoney', async () => {
    const items = await extraerLucaMoney()

    testItems(items)
  })

  it('guarda decrypto', async () => {
    const items = await extraerDecrypto()

    testItems(items)
  })

  it('guarda vesseo', async () => {
    const items = await extraerVesseo()

    testItems(items)
  })

  it('guarda astropay', async () => {
    const items = await extraerAstroPay()

    testItems(items)
  })

  it('guarda lunefi', async () => {
    const items = await extraerLunefi()

    testItems(items)
  })

  it('guarda berry', async () => {
    const items = await extraerBerry()

    testItems(items)
    expect(items[0].moneda).toBe('USDC')
  })
})
