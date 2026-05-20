import { describe, expect, it } from 'vitest'
import { extraerPresidentes } from '@/presidentes/extraccion/extraerPresidentes.js'
import { guardarPresidentes } from '@/presidentes/guardado/guardarPresidentes.js'
import { leerRuta } from '@/utils/rutas.js'

describe('guardarPresidentes', () => {
  it('guarda los presidentes y los puede leer de vuelta', async () => {
    const presidentes = await extraerPresidentes()

    expect(presidentes.length).toBeGreaterThan(0)

    const guardado = guardarPresidentes(presidentes)

    const leido = leerRuta('/presidentes')

    expect(leido).toEqual(JSON.parse(guardado))
    expect(leido.length).toEqual(presidentes.length)
  })
})
