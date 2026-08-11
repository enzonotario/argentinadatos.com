import { describe, expect, it } from 'vitest'
import {
  extraerRem,
  obtenerPublicacionesRem,
  obtenerUrlsPublicacionesRemDesdeUltimosInformes,
} from '@/finanzas/rem/extraccion/extraerRem.js'

const URLS_REM_2026 = [
  'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-rem-marzo-de-2026/',
  'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-febrero-de-2026/',
]

describe('extraerRem', () => {
  it(
    'descubre publicaciones REM desde la API de publicaciones del BCRA',
    async () => {
      const urls = await obtenerUrlsPublicacionesRemDesdeUltimosInformes(
        undefined,
        12,
      )

      expect(urls.length).toBeGreaterThan(0)
      expect(urls.length).toBeLessThanOrEqual(12)

      for (const url of urls) {
        expect(url).toMatch(
          /^https:\/\/www\.bcra\.gob\.ar\/publicaciones\/relevamiento-de-expectativas-de-mercado/i,
        )
        expect(url).not.toContain('sitiopublico.desa.bcra.net')
      }

      // La API del BCRA lista publicaciones recientes primero.
      expect(urls[0]).toContain('julio-de-2026')
    },
    30000,
  )

  it(
    'obtiene publicaciones REM con enlaces XLSX válidos',
    async () => {
      const publicaciones = await obtenerPublicacionesRem(URLS_REM_2026)

      expect(publicaciones.length).toBe(2)

      for (const publicacion of publicaciones) {
        expect(publicacion.url).toMatch(/^https:\/\/www\.bcra\.gob\.ar\//)
        expect(publicacion.xlsxUrl).toMatch(
          /relevamiento-expectativas-mercado.*\.xlsx$/i,
        )
        expect(publicacion.xlsxUrl).not.toContain('sitiopublico.desa.bcra.net')
        expect(publicacion.informe).toMatch(/^\d{4}-\d{2}$/)
      }

      expect(publicaciones.map(p => p.informe).sort()).toEqual([
        '2026-02',
        '2026-03',
      ])
    },
    30000,
  )

  it(
    'extrae todas las tablas de los XLSX del REM',
    async () => {
      const items = await extraerRem(URLS_REM_2026)

      expect(items.length).toBeGreaterThan(250)

      for (const item of items) {
        expect(item).toMatchObject({
          informe: expect.stringMatching(/^\d{4}-\d{2}$/),
          fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          muestra: expect.stringMatching(/^(todos|top_10)$/),
          indicador: expect.any(String),
          periodo: expect.any(String),
          referencia: expect.any(String),
          unidad: expect.any(String),
          fuente: 'BCRA REM',
          periodoTipo: expect.any(String),
          publicacionUrl: expect.stringMatching(/^https:\/\/www\.bcra\.gob\.ar\//),
          xlsxUrl: expect.stringMatching(/\.xlsx$/i),
        })

        expect(item.indicador.length).toBeGreaterThan(0)

        if (item.mediana !== null && item.mediana !== undefined) {
          expect(typeof item.mediana).toBe('number')
        }

        if (item.participantes !== null && item.participantes !== undefined) {
          expect(typeof item.participantes).toBe('number')
          expect(item.participantes).toBeGreaterThan(0)
        }
      }

      const marzoIpc = items.find(
        item =>
          item.informe === '2026-03' &&
          item.muestra === 'todos' &&
          item.indicador ===
            'Precios minoristas (IPC nivel general-Nacional; INDEC)' &&
          item.periodo === 'Mar-26',
      )

      expect(marzoIpc).toMatchObject({
        fecha: '2026-03-01',
        periodoTipo: 'mensual',
        periodoDesde: '2026-03-01',
        periodoHasta: '2026-03-31',
        referencia: 'var. % mensual',
        unidad: 'var. % mensual',
        mediana: 3,
        promedio: 3,
        participantes: 46,
      })

      const marzoTipoCambio = items.find(
        item =>
          item.informe === '2026-03' &&
          item.indicador === 'Tipo de cambio nominal' &&
          item.periodo === 'Apr-26' &&
          item.muestra === 'todos',
      )

      expect(marzoTipoCambio.mediana).toBe(1420)
      expect(marzoTipoCambio.unidad).toBe('$/USD')

      expect(items.some(item => item.informe === '2026-02')).toBe(true)
      expect(items.some(item => item.muestra === 'top_10')).toBe(true)
      expect(items.some(item => item.periodoTipo === 'trimestral')).toBe(true)
      expect(items.some(item => item.periodoTipo === 'anual')).toBe(true)
    },
    60000,
  )
})
