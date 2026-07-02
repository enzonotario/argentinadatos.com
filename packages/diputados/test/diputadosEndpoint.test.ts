import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint'
import { expect, it } from 'vitest'
import {
  getLegislaturaFromDiputado,
  readAllDiputados,
  writeDiputadosEndpoints,
} from '../src/diputados/diputados/diputadosEndpoint'

it('getLegislaturaFromDiputado', () => {
  expect(
    getLegislaturaFromDiputado({
      id: 'HCDN0001',
      periodoMandato: {
        inicio: '2023-12-10T00:00:00-03:00',
        fin: '2027-12-09T00:00:00-03:00',
      },
    } as any),
  ).toBe(2023)
})

it('readAllDiputados', () => {
  const diputados = readAllDiputados()

  expect(Array.isArray(diputados)).toBe(true)
  expect(diputados.length).toBeGreaterThan(0)
  expect(diputados[0]).toMatchObject({
    id: expect.any(String),
    nombre: expect.any(String),
    apellido: expect.any(String),
  })
})

it('writeDiputadosEndpoints', () => {
  const diputados = readAllDiputados()

  writeDiputadosEndpoints(diputados)

  const legislaturas = JSON.parse(readEndpoint('diputados/diputados') || '[]')

  expect(Array.isArray(legislaturas)).toBe(true)
  expect(legislaturas.every((value: unknown) => typeof value === 'number')).toBe(
    true,
  )
  expect(legislaturas.length).toBeGreaterThan(0)
})
