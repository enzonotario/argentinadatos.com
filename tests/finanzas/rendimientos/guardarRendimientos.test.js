import { describe, expect, it } from 'vitest'
import { leerRuta } from '@/utils/rutas.js'
import { guardarRendimientos } from '@/finanzas/rendimientos/guardarRendimientos.js'
import { extraerNexo } from '@/finanzas/rendimientos/extraerNexo.js'
import { extraerFiwind } from '@/finanzas/rendimientos/extraerFiwind.js'
import { extraerLetsbit } from '@/finanzas/rendimientos/extraerLetsbit.js'
import { extraerBelo } from '@/finanzas/rendimientos/extraerBelo.js'
import { extraerLemoncash } from '@/finanzas/rendimientos/extraerLemoncash.js'
import { extraerRipio } from '@/finanzas/rendimientos/extraerRipio.js'
import { extraerSatoshiTango } from '@/finanzas/rendimientos/extraerSatoshiTango.js'
import { extraerLucaMoney } from '@/finanzas/rendimientos/extraerLucaMoney.js'
import { extraerLunefi } from '@/finanzas/rendimientos/extraerLunefi.js'
import { extraerBerry } from '@/finanzas/rendimientos/extraerBerry.js'

async function testGuardarRendimientos(entidad, funcionExtraccion) {
  const items = await funcionExtraccion()

  const esperado = await guardarRendimientos(entidad, items)

  expect(esperado).toBeDefined()

  const guardado = await leerRuta(`/finanzas/rendimientos/${entidad}`)

  for (const item of items) {
    expect(guardado).toContainEqual({
      moneda: item.moneda,
      apy: item.apy,
      fecha: item.fecha,
    })
  }
}

describe('guardarRendimientos', () => {
  it('guarda nexo', async () => {
    await testGuardarRendimientos('nexo', extraerNexo)
  })

  it('guarda fiwind', async () => {
    await testGuardarRendimientos('fiwind', extraerFiwind)
  })

  it('guarda letsbit', async () => {
    await testGuardarRendimientos('letsbit', extraerLetsbit)
  })

  it('guarda belo', async () => {
    await testGuardarRendimientos('belo', extraerBelo)
  })

  it('guarda lemoncash', async () => {
    await testGuardarRendimientos('lemoncash', extraerLemoncash)
  })

  it('guarda ripio', async () => {
    await testGuardarRendimientos('ripio', extraerRipio)
  })

  it('guarda satoshitango', async () => {
    await testGuardarRendimientos('satoshitango', extraerSatoshiTango)
  })

  it('guarda lucamoney', async () => {
    await testGuardarRendimientos('lucamoney', extraerLucaMoney)
  })

  it('guarda lunefi', async () => {
    await testGuardarRendimientos('lunefi', extraerLunefi)
  })

  it('guarda berry', async () => {
    await testGuardarRendimientos('berry', extraerBerry)
  })
})
