import { describe, expect, it } from 'vitest'
import { extraerPresidentes } from '@/presidentes/extraccion/extraerPresidentes.esjs'
import { guardarPresidentes } from '@/presidentes/guardado/guardarPresidentes.esjs'
import { leerRuta } from '@/utils/rutas.esjs'

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
