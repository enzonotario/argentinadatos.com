import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { leerRuta } from '@/utils/rutas.js'
import {
  extraerConfianzaGobierno,
  normalizarFechaIcg,
  obtenerUrlExcelIcg,
  parsearWorkbookIcg,
} from '@/politica/indices/confianza-gobierno/extraccion/extraerConfianzaGobierno.js'
import confianzaGobierno from '@/politica/indices/confianza-gobierno/confianzaGobierno.comando.js'

describe('normalizarFechaIcg', () => {
  it('parsea fechas Date, ISO y abreviaturas en español', () => {
    expect(normalizarFechaIcg(new Date(Date.UTC(2026, 6, 1)))).toBe(
      '2026-07-01',
    )
    expect(normalizarFechaIcg('2023-01-01')).toBe('2023-01-01')
    expect(normalizarFechaIcg('jul-26')).toBe('2026-07-01')
    expect(normalizarFechaIcg('dic-99')).toBe('1999-12-01')
    expect(normalizarFechaIcg(null)).toBeNull()
  })
})

describe('obtenerUrlExcelIcg', () => {
  it('encuentra el link de Evolución Mensual del ICG', async () => {
    const html = `
      <div>
        <a href="/download.php?fname=_178518482874281600.xls" class="noicon">
          Evolución Mensual del ICG, 2001 - Presente (Excel)
        </a>
        <a href="/download.php?fname=_178518536914504700.dta">
          Microdatos Encuestas Mensuales ICG, 2001 - Presente (Stata)
        </a>
      </div>
    `

    const url = await obtenerUrlExcelIcg(html)
    expect(url).toBe(
      'https://www.utdt.edu/download.php?fname=_178518482874281600.xls',
    )
  })
})

describe('parsearWorkbookIcg', () => {
  it('parsea el Excel de UTDT', () => {
    const buffer = fs.readFileSync(
      new URL('./fixtures/icg.xls', import.meta.url),
    )
    const items = parsearWorkbookIcg(buffer)

    expect(items.length).toBeGreaterThan(200)
    expect(items[0]).toMatchObject({
      fecha: '2001-11-01',
      valor: expect.any(Number),
    })

    const julio2026 = items.find(item => item.fecha === '2026-07-01')
    expect(julio2026).toMatchObject({
      fecha: '2026-07-01',
      valor: expect.any(Number),
    })
    expect(julio2026.valor).toBeGreaterThan(0)
    expect(typeof julio2026.variacion).toBe('number')

    for (const item of items) {
      expect(item.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof item.valor).toBe('number')
    }
  })
})

describe('extraerConfianzaGobierno', () => {
  it(
    'extrae la serie mensual desde UTDT',
    async () => {
      const items = await extraerConfianzaGobierno()

      expect(items.length).toBeGreaterThan(200)

      for (const item of items) {
        expect(item.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof item.valor).toBe('number')
        expect(item.valor).toBeGreaterThan(0)
      }
    },
    60000,
  )
})

describe('confianzaGobierno', () => {
  it(
    'ejecuta el comando y guarda histórico y último',
    async () => {
      const rutasGuardadas = await confianzaGobierno()

      expect(rutasGuardadas).toEqual([
        '/politica/indices/confianza-gobierno',
        '/politica/indices/confianza-gobierno/ultimo',
      ])

      const historico = leerRuta('/politica/indices/confianza-gobierno')
      const ultimo = leerRuta('/politica/indices/confianza-gobierno/ultimo')

      expect(Array.isArray(historico)).toBe(true)
      expect(historico.length).toBeGreaterThan(200)
      expect(ultimo).toMatchObject({
        fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        valor: expect.any(Number),
      })
      expect(historico).toContainEqual(ultimo)
    },
    60000,
  )
})
