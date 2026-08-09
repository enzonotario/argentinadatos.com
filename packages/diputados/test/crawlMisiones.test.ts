import { describe, expect, it } from 'vitest'
import {
  matchMisionesDiputadoIds,
  rowToViajeInternacional,
  type MisionRecurso,
} from '../src/diputados/viajes/crawlMisiones'
import { parseCsvText } from '../src/diputados/viajes/crawlViajes'

const recurso: MisionRecurso = {
  id: 'm1',
  nombre: 'Misiones 2024',
  url: 'https://example.com/m.csv',
}

describe('rowToViajeInternacional', () => {
  it('parsea fila típica de misiones', () => {
    const csv = `fecha_inicio,fecha_fin,participa,ciudad_viaje,lugar,motivo,bloque,viaticos_consumidos,moneda,institucion_que_invita
2024-03-10,2024-03-15,ALVAREZ CLAUDIO,Brasilia,Brasil,Reunion bilateral,UPP,U$S 1200,USD,Parlamento Mercosur
`
    const rows = parseCsvText(csv)
    const viaje = rowToViajeInternacional(rows[0]!, recurso)
    expect(viaje).toMatchObject({
      ambito: 'internacional',
      anio: 2024,
      mes: 3,
      diputadoId: null,
      viaticosUsd: 1200,
      destino: expect.stringMatching(/Brasil/i),
    })
    expect(viaje?.nombre).toMatch(/Alvarez/i)
  })

  it('omite filas placeholder', () => {
    const csv = `participa,motivo
s/n,no se realizaron misiones
`
    const rows = parseCsvText(csv)
    expect(rowToViajeInternacional(rows[0]!, recurso)).toBeNull()
  })
})

describe('matchMisionesDiputadoIds', () => {
  it('asigna diputadoId por apellido|nombre', () => {
    const viajes = [
      {
        ambito: 'internacional' as const,
        anio: 2024,
        mes: 3,
        mesNombre: 'Marzo',
        documentoId: 'm1',
        documentoUrl: 'u',
        nombre: 'Alvarez, Claudio',
        senadorId: null,
        diputadoId: null,
        expediente: '',
        destino: 'Brasil',
        fechaInicio: '2024-03-10',
        fechaFin: '2024-03-15',
        fechaTexto: '2024-03-10 – 2024-03-15',
        asistenciaAlViajero: null,
        viaticos: true,
        viaticosUsd: 100,
        viaticosEuro: null,
        viaticosArs: null,
        motivo: 'x',
        bloque: null,
      },
    ]
    matchMisionesDiputadoIds(viajes, [
      { id: 'HCDN1', apellido: 'Alvarez', nombre: 'Claudio' },
    ])
    expect(viajes[0]!.diputadoId).toBe('HCDN1')
  })
})
