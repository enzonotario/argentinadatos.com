import { describe, expect, it } from 'vitest'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import {
  buildViajesConteo12m,
  buildViajesConteoTotal,
  buildViajesEndpointMap,
  collectViajeDocumentos,
  crawlViajes,
  parseInternacionalPdfRows,
  parseLugar,
  parseNacionalPdfRows,
  VIAJES_INDEX_URL,
  type ViajeDocumento,
} from '../src/senadores/crawlViajes'

describe('parseLugar', () => {
  it('extrae código IATA', () => {
    expect(parseLugar('Mar Del Plata (MDQ)')).toEqual({
      nombre: 'Mar del Plata',
      codigo: 'MDQ',
    })
    expect(parseLugar('Bariloche(BRC)')).toEqual({
      nombre: 'Bariloche',
      codigo: 'BRC',
    })
    expect(parseLugar('Buenos Aires')).toEqual({
      nombre: 'Buenos Aires',
      codigo: null,
    })
  })
})

describe('parseNacionalPdfRows', () => {
  it('parsea filas nombre/origen/destino', () => {
    const doc: ViajeDocumento = {
      id: '1765',
      ambito: 'nacional',
      anio: 2026,
      mes: 5,
      mesNombre: 'Mayo',
      url: 'https://www.senado.gob.ar/administrativo/verVuelo/1765',
    }
    const viajes = parseNacionalPdfRows([
      ['VIAJES NACIONALES MAYO 2026'],
      ['APELLIDO Y NOMBRE', 'ORIGEN', 'DESTINO'],
      ['Abad, Maximiliano', 'Mar Del Plata (MDQ)', 'Buenos Aires (BUE)'],
      ['Durango, Norma Haydee', 'Buenos Aires', 'Santa Rosa(RSA)'],
    ], doc)

    expect(viajes).toHaveLength(2)
    expect(viajes[0]).toMatchObject({
      ambito: 'nacional',
      anio: 2026,
      mes: 5,
      nombre: 'Abad, Maximiliano',
      origenCodigo: 'MDQ',
      destinoCodigo: 'BUE',
    })
    expect(viajes[1]).toMatchObject({
      origen: 'Buenos Aires',
      origenCodigo: null,
      destinoCodigo: 'RSA',
    })
  })
})

describe('parseInternacionalPdfRows', () => {
  const doc: ViajeDocumento = {
    id: '1385',
    ambito: 'internacional',
    anio: 2025,
    mes: null,
    mesNombre: null,
    url: 'https://www.senado.gob.ar/administrativo/verVuelo/1385',
  }

  it('parsea esquema moderno con continuaciones', () => {
    const viajes = parseInternacionalPdfRows([
      ['Registro de viajes oficiales 2025'],
      ['Autoridad', 'Expediente', 'Destino', 'Fecha', 'Asistencia al viajero', 'Viáticos', 'Motivo de viaje', 'Bloque'],
      ['ABRIL'],
      ['DE PEDRO, Eduardo Enrique', '600/2025', 'Ecuador', '13/04 al 15/04', 'Sí', 'Sí', 'Segunda vuelta electoral'],
      ['República de Ecuador.', 'Unidad Ciudadana'],
      ['MAYO'],
      ['ANDRADA, Guillermo Eduardo', '826/2024', 'España', '14/05 al 17/05', 'No', 'Sí', 'Expoliva 2025', 'Convicción Federal'],
      ['CREXELL, Carmen Lucila', '362/2025', 'Reino Unido de Gran Bretaña e Irlanda del'],
      ['Norte / Suiza', '13/10 al 24/10', 'Sí', 'Sí', 'London Metal Exchange'],
      ['Interparlamentaria', 'Movimiento Neuquino'],
    ], doc)

    expect(viajes).toHaveLength(3)
    expect(viajes[0]).toMatchObject({
      nombre: 'De Pedro, Eduardo Enrique',
      expediente: '600/2025',
      destino: 'Ecuador',
      fechaInicio: '2025-04-13',
      fechaFin: '2025-04-15',
      asistenciaAlViajero: true,
      viaticos: true,
      mes: 4,
      bloque: 'Unidad Ciudadana',
    })
    expect(viajes[0].motivo).toMatch(/Segunda vuelta/i)
    expect(viajes[0].motivo).toMatch(/Ecuador/i)

    expect(viajes[1]).toMatchObject({
      asistenciaAlViajero: false,
      viaticos: true,
      bloque: 'Convicción Federal',
    })

    expect(viajes[2]).toMatchObject({
      expediente: '362/2025',
      fechaInicio: '2025-10-13',
      bloque: 'Movimiento Neuquino',
    })
    expect(viajes[2].destino).toMatch(/Reino Unido/i)
    expect(viajes[2].destino).toMatch(/Suiza/i)
  })

  it('parsea esquema viejo con montos y fechas cortas', () => {
    const oldDoc: ViajeDocumento = { ...doc, id: '13', anio: 2012 }
    const viajes = parseInternacionalPdfRows([
      ['Autoridad', 'Expediente', 'Destino', 'Fecha', 'Viáticos USD', 'Motivo', 'Bloque'],
      ['FEBRERO'],
      ['BERMEJO, Rolando Adolfo', 'HSN 0204/2012', 'Chile', '02-Feb', '08-Feb', 'USD 1.000,00', 'Feria Papudo', 'PJ Frente para la Victoria'],
    ], oldDoc)

    expect(viajes).toHaveLength(1)
    expect(viajes[0]).toMatchObject({
      expediente: 'HSN 0204/2012',
      destino: 'Chile',
      fechaInicio: '2012-02-02',
      fechaFin: '2012-02-08',
      viaticosUsd: 1000,
      mes: 2,
    })
  })

  it('acepta expediente HSN sin barra (2014)', () => {
    const oldDoc: ViajeDocumento = { ...doc, id: '11', anio: 2014 }
    const viajes = parseInternacionalPdfRows([
      ['ENERO'],
      ['HIGONET, María de los Angeles', 'HSN 6548 2013', 'Chile', '08-ene', '10-ene', '$ 3.927,00', 'USS 0,00', '0,00 €', 'Reforma GRULAC'],
    ], oldDoc)
    expect(viajes).toHaveLength(1)
    expect(viajes[0]).toMatchObject({
      expediente: 'HSN 6548 2013',
      fechaInicio: '2014-01-08',
      fechaFin: '2014-01-10',
      viaticosArs: 3927,
      viaticosUsd: 0,
      viaticosEuro: 0,
      motivo: 'Reforma GRULAC',
      bloque: null,
    })
  })
})

describe('collectViajeDocumentos', () => {
  it('separa nacionales mensuales e internacionales anuales', () => {
    const html = `
      <div id="1E">
        <div class="accordionv-group">
          <a class="accordion-toggle">VIAJES NACIONALES AÑO 2026</a>
          <div class="accordion-inner">
            <div class="item"><a href="/administrativo/verVuelo/1685"></a><p>Enero</p></div>
            <div class="item"><a href="/administrativo/verVuelo/1705"></a><p>Febrero</p></div>
          </div>
        </div>
      </div>
      <div id="1F">
        <div class="accordionv-group">
          <a class="accordion-toggle">VIAJES INTERNACIONALES AÑO 2025</a>
          <div class="accordion-inner">
            <div class="item"><a href="/administrativo/verVuelo/1385"></a><p>DESCARGAR</p></div>
          </div>
        </div>
      </div>
    `
    const docs = collectViajeDocumentos(html)
    expect(docs).toEqual([
      expect.objectContaining({ id: '1685', ambito: 'nacional', anio: 2026, mes: 1 }),
      expect.objectContaining({ id: '1705', ambito: 'nacional', anio: 2026, mes: 2 }),
      expect.objectContaining({ id: '1385', ambito: 'internacional', anio: 2025, mes: null }),
    ])
  })
})

describe('buildViajesConteo12m', () => {
  it('cuenta nacionales e internacionales en la ventana de 12 meses', () => {
    const asOf = new Date('2026-08-08T12:00:00.000Z')
    const conteo = buildViajesConteo12m(
      {
        nacionales: [
          {
            ambito: 'nacional',
            anio: 2025,
            mes: 8,
            mesNombre: 'Agosto',
            documentoId: 'old',
            documentoUrl: 'https://example.com/old',
            nombre: 'Fuera',
            senadorId: '1',
            origen: 'A',
            origenCodigo: 'AAA',
            destino: 'B',
            destinoCodigo: 'BBB',
          },
          {
            ambito: 'nacional',
            anio: 2025,
            mes: 9,
            mesNombre: 'Septiembre',
            documentoId: 'in',
            documentoUrl: 'https://example.com/in',
            nombre: 'Dentro',
            senadorId: '1',
            origen: 'A',
            origenCodigo: 'AAA',
            destino: 'B',
            destinoCodigo: 'BBB',
          },
          {
            ambito: 'nacional',
            anio: 2026,
            mes: 5,
            mesNombre: 'Mayo',
            documentoId: 'in2',
            documentoUrl: 'https://example.com/in2',
            nombre: 'Otro',
            senadorId: '2',
            origen: 'A',
            origenCodigo: 'AAA',
            destino: 'B',
            destinoCodigo: 'BBB',
          },
        ],
        internacionales: [
          {
            ambito: 'internacional',
            anio: 2026,
            mes: 3,
            mesNombre: 'Marzo',
            documentoId: 'intl',
            documentoUrl: 'https://example.com/intl',
            nombre: 'Dentro',
            senadorId: '1',
            expediente: '1/2026',
            destino: 'Chile',
            fechaInicio: '2026-03-10',
            fechaFin: '2026-03-12',
            fechaTexto: null,
            asistenciaAlViajero: null,
            viaticos: null,
            viaticosUsd: null,
            viaticosEuro: null,
            viaticosArs: null,
            motivo: null,
            bloque: null,
          },
        ],
      },
      asOf,
    )

    expect(conteo.desde).toEqual({ anio: 2025, mes: 9 })
    expect(conteo.hasta).toEqual({ anio: 2026, mes: 8 })
    expect(conteo.porSenador['1']).toEqual({
      nacionales: 1,
      internacionales: 1,
      total: 2,
    })
    expect(conteo.porSenador['2']).toEqual({
      nacionales: 1,
      internacionales: 0,
      total: 1,
    })
  })
})

describe('buildViajesConteoTotal', () => {
  it('cuenta todos los viajes por senador sin ventana', () => {
    const conteo = buildViajesConteoTotal({
      nacionales: [
        {
          ambito: 'nacional',
          anio: 2020,
          mes: 1,
          mesNombre: 'Enero',
          documentoId: 'old',
          documentoUrl: 'https://example.com/old',
          nombre: 'A',
          senadorId: '1',
          origen: 'A',
          origenCodigo: 'AAA',
          destino: 'B',
          destinoCodigo: 'BBB',
        },
        {
          ambito: 'nacional',
          anio: 2026,
          mes: 5,
          mesNombre: 'Mayo',
          documentoId: 'new',
          documentoUrl: 'https://example.com/new',
          nombre: 'A',
          senadorId: '1',
          origen: 'A',
          origenCodigo: 'AAA',
          destino: 'B',
          destinoCodigo: 'BBB',
        },
      ],
      internacionales: [
        {
          ambito: 'internacional',
          anio: 2025,
          mes: 4,
          mesNombre: 'Abril',
          documentoId: 'i',
          documentoUrl: 'https://example.com/i',
          nombre: 'B',
          senadorId: '2',
          expediente: null,
          destino: 'Chile',
          fechaInicio: '2025-04-01',
          fechaFin: '2025-04-02',
          fechaTexto: null,
          asistenciaAlViajero: null,
          viaticos: null,
          viaticosUsd: null,
          viaticosEuro: null,
          viaticosArs: null,
          motivo: null,
          bloque: null,
        },
      ],
    })

    expect(conteo.porSenador['1']).toEqual({
      nacionales: 2,
      internacionales: 0,
      total: 2,
    })
    expect(conteo.porSenador['2']).toEqual({
      nacionales: 0,
      internacionales: 1,
      total: 1,
    })
  })
})

describe('buildViajesEndpointMap', () => {
  it('arma recortes por ámbito, año/mes y senador', () => {
    const data = {
      fuente: VIAJES_INDEX_URL,
      actualizado: '2026-01-01T00:00:00.000Z',
      documentos: [],
      nacionales: [
        {
          ambito: 'nacional' as const,
          anio: 2026,
          mes: 5,
          mesNombre: 'Mayo',
          documentoId: '1',
          documentoUrl: 'https://example.com/1',
          nombre: 'Abad, Maximiliano',
          senadorId: '546',
          origen: 'Mar del Plata',
          origenCodigo: 'MDQ',
          destino: 'Buenos Aires',
          destinoCodigo: 'BUE',
        },
      ],
      internacionales: [
        {
          ambito: 'internacional' as const,
          anio: 2025,
          mes: 4,
          mesNombre: 'Abril',
          documentoId: '2',
          documentoUrl: 'https://example.com/2',
          nombre: 'De Pedro, Eduardo Enrique',
          senadorId: '545',
          expediente: '600/2025',
          destino: 'Ecuador',
          fechaInicio: '2025-04-13',
          fechaFin: '2025-04-15',
          fechaTexto: '13/04 al 15/04',
          asistenciaAlViajero: true,
          viaticos: true,
          viaticosUsd: null,
          viaticosEuro: null,
          viaticosArs: null,
          motivo: 'Test',
          bloque: 'Unidad Ciudadana',
        },
      ],
    }

    const endpoints = buildViajesEndpointMap(data, ['546', '545', '999'])

    expect(endpoints['/senado/viajes/nacionales']).toHaveLength(1)
    expect(endpoints['/senado/viajes/nacionales/2026']).toHaveLength(1)
    expect(endpoints['/senado/viajes/nacionales/2026/5']).toHaveLength(1)
    expect(endpoints['/senado/viajes/internacionales/2025']).toHaveLength(1)
    expect(endpoints['/senado/viajes/conteo-12m']).toMatchObject({
      ventanaMeses: 12,
      porSenador: expect.any(Object),
    })
    expect(endpoints['/senado/viajes/conteo']).toMatchObject({
      porSenador: {
        '546': { nacionales: 1, internacionales: 0, total: 1 },
        '545': { nacionales: 0, internacionales: 1, total: 1 },
      },
    })
    expect(endpoints['/senado/senadores/546/viajes']).toMatchObject({
      senadorId: '546',
      nacionales: [expect.objectContaining({ origenCodigo: 'MDQ' })],
      internacionales: [],
    })
    expect(endpoints['/senado/senadores/999/viajes']).toEqual({
      senadorId: '999',
      nacionales: [],
      internacionales: [],
    })
  })
})

describe('crawlViajes (red)', () => {
  it('descarga PDFs, parsea y persiste /senado/viajes', async () => {
    const data = await crawlViajes({ force: false })

    expect(data.documentos.length).toBeGreaterThanOrEqual(100)
    expect(data.nacionales.length).toBeGreaterThan(1000)
    expect(data.internacionales.length).toBeGreaterThan(50)

    const mayo2026 = data.nacionales.filter(v => v.anio === 2026 && v.mes === 5)
    expect(mayo2026.length).toBeGreaterThan(100)
    expect(mayo2026.some(v => /Abad/i.test(v.nombre))).toBe(true)

    const intl2025 = data.internacionales.filter(v => v.anio === 2025)
    expect(intl2025.some(v => /De Pedro/i.test(v.nombre))).toBe(true)

    const matched = data.nacionales.filter(v => v.senadorId).length
    expect(matched).toBeGreaterThan(500)

    const persisted = JSON.parse(readEndpoint('/senado/viajes') || '{}')
    expect(persisted.nacionales.length).toBe(data.nacionales.length)
    expect(persisted.internacionales.length).toBe(data.internacionales.length)

    expect(JSON.parse(readEndpoint('/senado/viajes/nacionales/2026/5') || '[]').length).toBe(mayo2026.length)
    const abadViajes = JSON.parse(readEndpoint('/senado/senadores/546/viajes') || '{}')
    expect(abadViajes.nacionales.length).toBeGreaterThan(0)
  }, 300_000)
})
