import { describe, expect, it } from 'vitest'
import {
  clavesSlugFondo,
  slugPublicoFondo,
} from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'
import { seleccionarFondosComparatasas } from '@/finanzas/fci/fondos/guardado/guardarComparatasas.js'

describe('slugPublicoFondo', () => {
  it('usa el nombre actual aunque el slug interno sea de un nombre CNV viejo', () => {
    expect(
      slugPublicoFondo({
        slug: 'cocos-retorno-total-iii-clase-a',
        nombre: 'Cocos Pesos Plus - Clase A',
        fondoId: '1651',
        claseId: '5496',
      }),
    ).toBe('cocos-pesos-plus-clase-a')
  })

  it('incluye slug interno y slug público como claves de búsqueda', () => {
    expect(
      clavesSlugFondo({
        slug: 'ieb-ahorro-clase-a',
        nombre: 'Ciclo Nova Ahorro - Clase A',
      }),
    ).toEqual(['ciclo-nova-ahorro-clase-a', 'ieb-ahorro-clase-a'])
  })
})

describe('seleccionarFondosComparatasas', () => {
  it('encuentra fondos de mappings aunque SQLite tenga un slug CNV distinto', () => {
    const fondos = [
      {
        slug: 'cocos-retorno-total-iii-clase-a',
        nombre: 'Cocos Pesos Plus - Clase A',
        fondoId: '1651',
        claseId: '5496',
      },
      {
        slug: 'pionero-acciones',
        nombre: 'Pionero Acciones - Clase A',
        fondoId: '39',
        claseId: '39',
      },
      {
        slug: 'crecer-renta-dolar-clase-a',
        nombre: 'Crecer Renta Dólares - Clase A',
        fondoId: '1637',
        claseId: '5432',
      },
    ]

    const { encontrados, noEncontrados } = seleccionarFondosComparatasas(
      fondos,
      [
        'cocos-pesos-plus-clase-a',
        'pionero-acciones-clase-a',
        'crecer-renta-dolares-clase-a',
        'fondo-inexistente',
      ],
    )

    expect(encontrados.map(fondo => fondo.nombre)).toEqual([
      'Cocos Pesos Plus - Clase A',
      'Pionero Acciones - Clase A',
      'Crecer Renta Dólares - Clase A',
    ])
    expect(noEncontrados).toEqual(['fondo-inexistente'])
  })

  it('no duplica un fondo si el mapping lista el slug público y el interno', () => {
    const fondos = [
      {
        slug: 'ieb-ahorro-clase-a',
        nombre: 'Ciclo Nova Ahorro - Clase A',
        fondoId: '1148',
        claseId: '3377',
      },
    ]

    const { encontrados, noEncontrados } = seleccionarFondosComparatasas(
      fondos,
      ['ciclo-nova-ahorro-clase-a', 'ieb-ahorro-clase-a'],
    )

    expect(encontrados).toHaveLength(1)
    expect(encontrados[0].nombre).toBe('Ciclo Nova Ahorro - Clase A')
    expect(noEncontrados).toEqual([])
  })
})
