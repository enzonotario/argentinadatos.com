import { describe, expect, it } from 'vitest'
import {
  allocateUniqueFundSlug,
  buildFundSlug,
} from '../../../apps/cafci-worker/src/utils/buildFundSlug.js'

describe('allocateUniqueFundSlug', () => {
  it('conserva el slug si no está tomado por otra clase', () => {
    const taken = new Set(['otro-fondo'])

    expect(
      allocateUniqueFundSlug('mercado-fondo-clase-a', {
        claseId: '1982',
        isTaken: slug => taken.has(slug),
      }),
    ).toBe('mercado-fondo-clase-a')
  })

  it('agrega el claseId cuando el nombre ya está usado', () => {
    const taken = new Set(['alpha'])

    expect(
      allocateUniqueFundSlug('alpha', {
        claseId: '99',
        isTaken: slug => taken.has(slug),
      }),
    ).toBe('alpha-99')
  })

  it('incrementa el sufijo si claseId también choca', () => {
    const taken = new Set(['alpha', 'alpha-99'])

    expect(
      allocateUniqueFundSlug('alpha', {
        claseId: '99',
        isTaken: slug => taken.has(slug),
      }),
    ).toBe('alpha-99-2')
  })
})

describe('buildFundSlug', () => {
  it('normaliza el nombre y no incluye ids si hay nombre', () => {
    expect(
      buildFundSlug({
        nombre: 'Mercado Fondo - Clase A',
        fondoId: '956',
        claseId: '1982',
      }),
    ).toBe('mercado-fondo-clase-a')
  })
})
