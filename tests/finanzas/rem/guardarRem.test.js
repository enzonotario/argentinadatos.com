import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { guardarRem } from '@/finanzas/rem/guardado/guardarRem.esjs'
import { RemDatabaseService } from '@/finanzas/rem/database/service.esjs'
import { leerRuta } from '@/utils/rutas.esjs'

const DB_PATH = '/tmp/rem-test.sqlite'
const TEST_URL = `file:${DB_PATH}`

const items = [
  {
    informe: '2026-03',
    fecha: '2026-03-01',
    muestra: 'todos',
    indicador: 'Precios minoristas (IPC nivel general-Nacional; INDEC)',
    periodo: 'Mar-26',
    periodoTipo: 'mensual',
    periodoDesde: '2026-03-01',
    periodoHasta: '2026-03-31',
    referencia: 'var. % mensual',
    referenciaFecha: null,
    unidad: 'var. % mensual',
    mediana: 3,
    promedio: 3,
    desvio: 0.2,
    maximo: 3.5,
    minimo: 2.5,
    percentil90: 3.2,
    percentil75: 3.1,
    percentil25: 2.9,
    percentil10: 2.8,
    participantes: 46,
    fuente: 'BCRA REM',
    publicacionUrl:
      'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-rem-marzo-de-2026/',
    xlsxUrl:
      'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/tablas-relevamiento-expectativas-mercado-mar-2026.xlsx',
  },
  {
    informe: '2026-02',
    fecha: '2026-02-01',
    muestra: 'todos',
    indicador: 'Tipo de cambio nominal',
    periodo: 'Mar-26',
    periodoTipo: 'mensual',
    periodoDesde: '2026-03-01',
    periodoHasta: '2026-03-31',
    referencia: '$/USD',
    referenciaFecha: null,
    unidad: '$/USD',
    mediana: 1400,
    promedio: 1405,
    desvio: 25,
    maximo: 1500,
    minimo: 1350,
    percentil90: 1450,
    percentil75: 1420,
    percentil25: 1380,
    percentil10: 1360,
    participantes: 45,
    fuente: 'BCRA REM',
    publicacionUrl:
      'https://www.bcra.gob.ar/publicaciones/relevamiento-de-expectativas-de-mercado-febrero-de-2026/',
    xlsxUrl:
      'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/informes/tablas-relevamiento-expectativas-mercado-feb-2026.xlsx',
  },
]

describe('guardarRem', () => {
  afterEach(() => {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  })

  it('guarda en SQLite/libSQL y genera endpoints estáticos', async () => {
    const endpoints = await guardarRem(items, TEST_URL)

    const db = new RemDatabaseService(TEST_URL)
    await db.initialize()
    const todos = await db.getAllExpectativas()
    const ultimo = await db.getLatestExpectativas()
    db.close()

    expect(todos.length).toBe(2)
    expect(ultimo.length).toBe(1)
    expect(ultimo[0].informe).toBe('2026-03')

    expect(endpoints).toEqual([
      '/rems/ultimo',
      '/rems/2026/03',
      '/rems/2026/02',
    ])
    expect(leerRuta('/rems')).toEqual(endpoints)
    expect(leerRuta('/rems/ultimo')).toEqual(ultimo)
    expect(leerRuta('/rems/2026/03')).toEqual([todos[0]])
    expect(leerRuta('/rems/2026/02')).toEqual([todos[1]])
  })
})
