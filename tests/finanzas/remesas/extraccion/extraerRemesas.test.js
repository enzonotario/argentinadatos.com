import { describe, expect, it } from 'vitest'
import {
  enriquecerRemesasConDetalles,
  extraerRemesas,
  normalizarDetallesRemesa,
  normalizarRemesa,
  parsearRemesasDesdeHtml,
} from '@/finanzas/remesas/extraccion/extraerRemesas.js'
import {
  extraerRemesasDesdeJs,
  mapearCocosDesdeRendimientos,
} from '@/finanzas/remesas/extraccion/extraerCocosRemesas.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe('normalizarRemesa', () => {
  it('conserva detalles por columna sin pisar el valor principal', () => {
    expect(
      normalizarRemesa({
        compania: 'Takenos',
        cuentaPropia: 'Sí',
        moneda: 'CRIPTO',
        inversiones: true,
        tarjetaUsa: 'Si',
        costoRecibirPagos: '0',
        costoMantenimientoTarjeta: '0 USD',
        costoTarjeta: '1%',
        retiroArs: '0',
        detalles: {
          costoRecibirPagos:
            'Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD',
          retiroArs: '  ',
        },
        calificacionAndroid: 4.2,
        calificacionIos: 4.2,
      }),
    ).toEqual({
      compania: 'Takenos',
      cuentaPropia: true,
      moneda: 'CRIPTO',
      inversiones: true,
      tarjetaUsa: true,
      costoRecibirPagos: '0',
      costoMantenimientoTarjeta: '0 USD',
      costoTarjeta: '1%',
      retiroArs: '0',
      detalles: {
        costoRecibirPagos:
          'Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD',
      },
      calificacionAndroid: 4.2,
      calificacionIos: 4.2,
    })
  })

  it('acepta extras como alias de detalles y descarta valores vacíos', () => {
    expect(
      normalizarRemesa({
        compania: 'Wise',
        cuentaPropia: false,
        inversiones: false,
        tarjetaUsa: false,
        extras: {
          costoTarjeta: '',
          retiroArs: 'Puede variar según método de retiro',
        },
      }),
    ).toMatchObject({
      compania: 'Wise',
      detalles: {
        retiroArs: 'Puede variar según método de retiro',
      },
    })
  })
})

describe('parsearRemesasDesdeHtml', () => {
  it('extrae el dataset estructurado embebido en Next.js', () => {
    const html = `
      <html>
        <body>
          <script>
            self.__next_f.push([1,"47:[\\"$\\",\\"$L48\\",null,{\\"serviceResponse\\":{\\"data\\":[{\\"company\\":\\"takenos\\",\\"receivePaymentsCost\\":{\\"description\\":\\"0\\",\\"popup\\":\\"Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD\\"}}]}}]"])
          </script>
        </body>
      </html>
    `

    expect(parsearRemesasDesdeHtml(html)).toEqual([
      {
        company: 'takenos',
        receivePaymentsCost: {
          description: '0',
          popup:
            'Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD',
        },
      },
    ])
  })
})

describe('normalizarDetallesRemesa', () => {
  it('retorna null si no hay detalles útiles', () => {
    expect(normalizarDetallesRemesa()).toBeNull()
    expect(normalizarDetallesRemesa({ costoRecibirPagos: '  ' })).toBeNull()
  })
})

describe('enriquecerRemesasConDetalles', () => {
  it('inyecta detalles desde el HTML estructurado según compañía', () => {
    const remesas = [
      normalizarRemesa({
        compania: 'takenos',
        costoRecibirPagos: '0',
      }),
    ]

    const html = [
      normalizarRemesa({
        compania: 'takenos',
        detalles: {
          costoRecibirPagos:
            'Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD',
        },
      }),
    ]

    expect(enriquecerRemesasConDetalles(remesas, html)).toEqual([
      expect.objectContaining({
        compania: 'takenos',
        detalles: {
          costoRecibirPagos:
            'Para ACH es 0, para wire doméstica es 25 USD y swift 35 USD',
        },
      }),
    ])
  })
})

describe.skipIf(!tieneFirecrawl)('extraerRemesas (Firecrawl real)', () => {
  it('extrae tabla de remesas desde dolarito.ar/remotito', async () => {
    const payload = await extraerRemesas()
    const remesas = payload.remesas

    expect(payload.fechaActualizacion).toBeTruthy()
    expect(payload.fechaActualizacion).toMatch(/Z$/)
    expect(Array.isArray(remesas)).toBe(true)
    expect(remesas.length).toBeGreaterThan(0)

    const companias = new Set(remesas.map(r => r.compania))
    expect(companias.size).toBe(remesas.length)

    for (const row of remesas) {
      expect(typeof row.compania).toBe('string')
      expect(row.compania.length).toBeGreaterThan(0)
      expect(typeof row.cuentaPropia).toBe('boolean')
      expect(typeof row.inversiones).toBe('boolean')
      expect(typeof row.tarjetaUsa).toBe('boolean')
      if (row.detalles) {
        expect(typeof row.detalles).toBe('object')
      }
    }

    const takenos = remesas.find(
      row => row.compania.toLowerCase() === 'takenos',
    )

    expect(takenos?.detalles?.costoRecibirPagos).toContain('Para ACH es 0')

    console.log('[extraerRemesas.real]', remesas.length, 'plataformas', {
      muestra: remesas.slice(0, 3),
    })

    const cocos = remesas.find(
      row => row.compania.toLowerCase() === 'cocos',
    )

    if (cocos) {
      expect(cocos.compania).toBe('Cocos')
      expect(cocos.cuentaPropia).toBe(true)
      expect(cocos.moneda).toBe('FIAT')
    }
  }, 120000)
})

describe('extraerRemesasDesdeJs', () => {
  it('extrae el array REMESAS desde tty.js minificado', () => {
    const js = `
      const REMESAS = [
        { name: 'Cocos', fee: 0.50, feeMin: 2.50, checking: true, subnominada: true, card: true, mantenimientoFree: true, note: 'todo gratis · wire/ach' },
        { name: 'Wallbit', fee: 0, checking: true, card: true, mantenimientoFree: true },
      ];
    `

    const remesas = extraerRemesasDesdeJs(js)

    expect(Array.isArray(remesas)).toBe(true)
    expect(remesas).toHaveLength(2)
    expect(remesas[0].name).toBe('Cocos')
    expect(remesas[0].fee).toBe(0.50)
    expect(remesas[1].name).toBe('Wallbit')
  })
})

describe('mapearCocosDesdeRendimientos', () => {
  it('convierte data de rendimientos.co al esquema de remesas', () => {
    const cocosRaw = {
      name: 'Cocos',
      fee: 0.50,
      feeMin: 2.50,
      checking: true,
      subnominada: true,
      card: true,
      mantenimientoFree: true,
      note: 'todo gratis · wire/ach',
    }

    const remesa = mapearCocosDesdeRendimientos(cocosRaw)

    expect(remesa.compania).toBe('Cocos')
    expect(remesa.cuentaPropia).toBe(true)
    expect(remesa.moneda).toBe('FIAT')
    expect(remesa.inversiones).toBe(true)
    expect(remesa.tarjetaUsa).toBe(true)
    expect(remesa.costoRecibirPagos).toBe('0.5%')
    expect(remesa.costoMantenimientoTarjeta).toBe('0 USD')
    expect(remesa.costoTarjeta).toBe('0%')
    expect(remesa.retiroArs).toBe('0')
    expect(remesa.calificacionAndroid).toBeNull()
    expect(remesa.calificacionIos).toBeNull()
    expect(remesa.detalles).toEqual({
      costoRecibirPagos: 'Mínimo 2.5 USD. todo gratis · wire/ach',
    })
  })

  it('maneja Cocos sin note ni feeMin', () => {
    const cocosRaw = {
      name: 'Cocos',
      fee: 1.00,
      checking: false,
      subnominada: false,
      card: false,
      mantenimientoFree: false,
    }

    const remesa = mapearCocosDesdeRendimientos(cocosRaw)

    expect(remesa.cuentaPropia).toBe(false)
    expect(remesa.inversiones).toBe(false)
    expect(remesa.tarjetaUsa).toBe(false)
    expect(remesa.costoRecibirPagos).toBe('1%')
    expect(remesa.costoMantenimientoTarjeta).toBeNull()
    expect(remesa.detalles).toBeNull()
  })
})
