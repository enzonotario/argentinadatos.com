import { describe, expect, it } from 'vitest'
import {
  applyBloquesToSenadores,
  downloadSenadoresVigentes,
} from '../src/senadores/applyBloques'

describe('applyBloquesToSenadores', () => {
  it('aplica bloque por id a todos los mandatos', () => {
    const senadores = [
      { id: '546', bloque: null as string | null },
      { id: '546', bloque: null as string | null },
      { id: '999', bloque: null as string | null },
    ]

    const { matchedIds } = applyBloquesToSenadores(senadores, [
      {
        id: '546',
        bloque: 'UCR - UNIÓN CÍVICA RADICAL',
        apellido: 'ABAD',
        nombre: 'MAXIMILIANO',
        provincia: 'BUENOS AIRES',
        partido: 'JUNTOS POR EL CAMBIO',
      },
    ])

    expect(matchedIds).toEqual(['546'])
    expect(senadores[0].bloque).toMatch(/Ucr/i)
    expect(senadores[1].bloque).toBe(senadores[0].bloque)
    expect(senadores[2].bloque).toBeNull()
  })
})

describe('downloadSenadoresVigentes (red)', () => {
  it('trae ~72 vigentes con BLOQUE', async () => {
    const vigentes = await downloadSenadoresVigentes()
    expect(vigentes.length).toBe(72)
    expect(vigentes.every(v => v.id && v.bloque)).toBe(true)

    const abad = vigentes.find(v => v.id === '546')
    expect(abad?.bloque).toMatch(/UCR/i)
  }, 30_000)
})
