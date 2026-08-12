import { describe, expect, it } from 'vitest'
import { logGrupo } from '@/log.js'
import { extraerRemesas } from '@/finanzas/remesas/extraccion/extraerRemesas.js'
import { extraerCocosRemesas } from '@/finanzas/remesas/extraccion/extraerCocosRemesas.js'
import {
  extraerBeloRemesas,
  extraerPorcentajePrincipal,
  mapearBeloDesdeExtracciones,
} from '@/finanzas/remesas/extraccion/extraerBeloRemesas.js'

const tieneFirecrawl =
  Boolean(import.meta.env.VITE_FIRECRAWL_API_KEY) &&
  Boolean(import.meta.env.VITE_FIRECRAWL_BASE_URL)

describe('mapearBeloDesdeExtracciones', () => {
  it('fusiona tarjeta + cuenta USD + LUX priorizando fees reales', () => {
    const remesa = mapearBeloDesdeExtracciones([
      {
        fuente: 'tarjeta',
        datos: {
          compania: 'Belo',
          cuentaPropia: true,
          moneda: 'FIAT',
          inversiones: false,
          tarjetaUsa: true,
          costoRecibirPagos: 'No',
          costoMantenimientoTarjeta: 'No',
          costoTarjeta: 'Free',
          retiroArs: 'No',
          detalles: {
            tarjetaUsa: 'Emitida en exterior (belo LUX).',
            moneda: 'Acepta pesos, USD, USDT, USDC, BTC, y ETH.',
            costoMantenimientoTarjeta: 'No hay costo de mantenimiento mensual.',
          },
        },
      },
      {
        fuente: 'cuentaUsd',
        datos: {
          compania: 'Belo',
          cuentaPropia: true,
          moneda: 'FIAT',
          inversiones: false,
          tarjetaUsa: false,
          costoRecibirPagos: '0.5% de la transacción',
          costoMantenimientoTarjeta: '3 USD (apertura de cuenta)',
          costoTarjeta: null,
          retiroArs: null,
          detalles: {
            moneda: 'Dólares digitales (USDC) ingresan a la cuenta como saldo.',
            costoRecibirPagos:
              '0.5% para ACH y Wire (mínimos de 0.5 USD y 20 USD, respectivamente).',
            costoMantenimientoTarjeta:
              'Costo de apertura de cuenta en USD es 3 USD, activa por 1 año.',
          },
        },
      },
      {
        fuente: 'lux',
        datos: {
          compania: 'Belo',
          cuentaPropia: true,
          moneda: 'FIAT',
          inversiones: false,
          tarjetaUsa: true,
          costoRecibirPagos: 'No',
          costoMantenimientoTarjeta: '0 USD',
          costoTarjeta: '0 USD',
          retiroArs: '0 USD',
          detalles: {
            tarjetaUsa: 'Tarjeta emitida en el extranjero.',
            costoMantenimientoTarjeta:
              'No tiene cuota mensual ni de mantenimiento.',
          },
        },
      },
    ])

    expect(remesa).toMatchObject({
      compania: 'Belo',
      cuentaPropia: true,
      moneda: 'CRIPTO',
      inversiones: true,
      tarjetaUsa: true,
      costoRecibirPagos: '0.5%',
      costoMantenimientoTarjeta: '0 USD',
      retiroArs: '0',
    })

    expect(remesa.detalles?.costoRecibirPagos).toContain('ACH')
    expect(remesa.detalles?.tarjetaUsa?.toLowerCase()).toMatch(
      /lux|exterior|extranjero/,
    )
  })

  it('extrae porcentaje principal desde texto', () => {
    expect(extraerPorcentajePrincipal('0,5% de la transacción')).toBe('0.5%')
    expect(extraerPorcentajePrincipal('sin dato')).toBeNull()
  })
})

describe.skipIf(!tieneFirecrawl)('extraerRemesas', () => {
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

    expect(takenos).toBeDefined()

    if (takenos?.detalles?.costoRecibirPagos) {
      expect(takenos.detalles.costoRecibirPagos).toContain('Para ACH es 0')
    }

    const cocos = remesas.find(row => row.compania.toLowerCase() === 'cocos')

    if (cocos) {
      expect(cocos.compania).toBe('Cocos')
      expect(cocos.cuentaPropia).toBe(true)
      expect(cocos.moneda).toBe('FIAT')
    }

    const belo = remesas.find(row => row.compania.toLowerCase() === 'belo')

    if (belo) {
      expect(belo.compania).toBe('Belo')
      expect(belo.cuentaPropia).toBe(true)
      expect(belo.moneda).toBe('CRIPTO')
      expect(belo.tarjetaUsa).toBe(true)
      expect(belo.costoRecibirPagos).toMatch(/0\.?5%/)
    }
  }, 180000)
})

describe('extraerCocosRemesas', () => {
  it('extrae Cocos desde rendimientos.co/tty.js', async () => {
    const log = logGrupo({ fuente: 'test', tipo: 'extraccion' })
    const remesa = await extraerCocosRemesas(log)

    expect(remesa).toMatchObject({
      compania: 'Cocos',
      cuentaPropia: expect.any(Boolean),
      moneda: 'FIAT',
      inversiones: expect.any(Boolean),
      tarjetaUsa: expect.any(Boolean),
    })

    if (remesa.costoRecibirPagos) {
      expect(typeof remesa.costoRecibirPagos).toBe('string')
    }
  }, 30000)
})

describe.skipIf(!tieneFirecrawl)('extraerBeloRemesas', () => {
  it('extrae Belo desde belo.app + help center', async () => {
    const log = logGrupo({ fuente: 'test', tipo: 'extraccion' })
    const remesa = await extraerBeloRemesas(log)

    expect(remesa).toMatchObject({
      compania: 'Belo',
      cuentaPropia: true,
      moneda: 'CRIPTO',
      inversiones: true,
      tarjetaUsa: true,
      costoMantenimientoTarjeta: '0 USD',
    })

    expect(remesa.costoRecibirPagos).toMatch(/0\.?5%/)
  }, 180000)
})
