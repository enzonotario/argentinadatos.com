import { describe, expect, it } from 'vitest'
import {
  appendRecintoSnapshot,
  asignarBancasHistoricas,
  createBancaResolver,
  findSnapshotForFecha,
  snapshotFromPayload,
} from '../src/diputados/diputados/recintoHistorial.ts'
import type { RecintoAsiento, RecintoPayload } from '../src/diputados/diputados/scrapeRecinto.ts'

function asiento(banca: number, apellido: string, nombre: string, extra: Partial<RecintoAsiento> = {}): RecintoAsiento {
  return {
    banca,
    idAutoridad: `a${banca}`,
    cuil: `c${banca}`,
    apellido,
    nombre,
    distrito: 'BUENOS AIRES',
    bloque: 'BLOQUE X',
    bloqueColor: null,
    interbloque: null,
    interbloqueColor: null,
    mandato: '2025-2029',
    mandatoFin: null,
    estado: 'ACTIVO',
    diputadoId: `HCDN-${apellido}-${nombre}`,
    ...extra,
  }
}

function payload(scrapedAt: string, asientos: RecintoAsiento[]): RecintoPayload {
  return { fuente: 'test', scrapedAt, asientos, vacantes: [] }
}

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

describe('appendRecintoSnapshot', () => {
  const base = [asiento(1, 'Pérez', 'Juan'), asiento(2, 'Gómez', 'Ana')]

  it('inicia el historial con el primer scrape', () => {
    const h = appendRecintoSnapshot([], payload('2026-11-01T10:00:00Z', base))
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ desde: '2026-11-01T10:00:00Z', hasta: '2026-11-01T10:00:00Z' })
  })

  it('extiende hasta si el mapa no cambió, aunque cambie el bloque', () => {
    const h1 = appendRecintoSnapshot([], payload('2026-11-01T10:00:00Z', base))
    const cambioBloque = [asiento(1, 'Pérez', 'Juan', { bloque: 'OTRO' }), asiento(2, 'Gómez', 'Ana')]
    const h2 = appendRecintoSnapshot(h1, payload('2026-11-05T10:00:00Z', cambioBloque))
    expect(h2).toHaveLength(1)
    expect(h2[0]).toMatchObject({ desde: '2026-11-01T10:00:00Z', hasta: '2026-11-05T10:00:00Z' })
    expect(h2[0]!.asientos[0]!.bloque).toBe('OTRO')
  })

  it('agrega un snapshot cuando alguien cambia de banca o es reemplazado', () => {
    const h1 = appendRecintoSnapshot([], payload('2026-11-01T10:00:00Z', base))
    const reemplazo = [asiento(1, 'Pérez', 'Juan'), asiento(2, 'López', 'Marta')]
    const h2 = appendRecintoSnapshot(h1, payload('2026-11-10T10:00:00Z', reemplazo))
    expect(h2).toHaveLength(2)
    expect(h2[0]!.hasta).toBe('2026-11-01T10:00:00Z')
    expect(h2[1]!.desde).toBe('2026-11-10T10:00:00Z')
  })

  it('no muta el historial recibido', () => {
    const h1 = appendRecintoSnapshot([], payload('2026-11-01T10:00:00Z', base))
    const copia = JSON.stringify(h1)
    appendRecintoSnapshot(h1, payload('2026-11-02T10:00:00Z', base))
    expect(JSON.stringify(h1)).toBe(copia)
  })
})

describe('findSnapshotForFecha', () => {
  const a = snapshotFromPayload(payload('2026-11-01T00:00:00Z', [asiento(1, 'Pérez', 'Juan')]))
  const b = snapshotFromPayload(payload('2026-11-20T00:00:00Z', [asiento(1, 'López', 'Marta')]))
  a.hasta = '2026-11-10T00:00:00Z'
  const historial = [a, b]

  it('elige el snapshot que contiene la fecha', () => {
    expect(findSnapshotForFecha(historial, day('2026-11-05'))).toBe(a)
    expect(findSnapshotForFecha(historial, day('2026-11-22'))).toBe(b)
  })

  it('en un hueco elige el más cercano si está dentro de la tolerancia', () => {
    expect(findSnapshotForFecha(historial, day('2026-11-12'))).toBe(a)
    expect(findSnapshotForFecha(historial, day('2026-11-18'))).toBe(b)
  })

  it('devuelve null si el acta queda lejos de todo scrape', () => {
    expect(findSnapshotForFecha(historial, day('2026-10-01'))).toBeNull()
    expect(findSnapshotForFecha(historial, day('2026-12-30'))).toBeNull()
    expect(findSnapshotForFecha([], day('2026-11-05'))).toBeNull()
  })
})

describe('createBancaResolver', () => {
  const snapshot = snapshotFromPayload(
    payload('2026-11-01T00:00:00Z', [
      asiento(0, 'Menem', 'Martín'),
      asiento(10, 'Estévez', 'Gabriela'),
      asiento(11, 'García', 'Juan Carlos'),
      asiento(12, 'García', 'Juan Pablo'),
      asiento(13, 'García', 'Ana'),
      asiento(14, 'García', 'Ana Laura'),
    ]),
  )
  const resolve = createBancaResolver(snapshot)

  it('matchea sin tildes por apellido + primer nombre', () => {
    expect(resolve('Estevez, Gabriela')).toBe(10)
  })

  it('ignora la banca 0 (podio)', () => {
    expect(resolve('Menem, Martín')).toBeNull()
  })

  it('no adivina cuando apellido + primer nombre es ambiguo', () => {
    expect(resolve('García, Ana')).toBeNull()
  })

  it('desempata apellidos compuestos con el apellido completo', () => {
    const compuestos = createBancaResolver(
      snapshotFromPayload(
        payload('2026-11-01T00:00:00Z', [
          asiento(20, 'De Sensi', 'María Florencia'),
          asiento(21, 'De la Rosa', 'María Graciela'),
        ]),
      ),
    )
    expect(compuestos('De Sensi, Maria Florencia')).toBe(20)
    expect(compuestos('De la Rosa, Maria Graciela')).toBe(21)
  })

  it('devuelve null para nombres desconocidos', () => {
    expect(resolve('Nadie, Nunca')).toBeNull()
  })
})

describe('asignarBancasHistoricas', () => {
  const snapshotViejo = snapshotFromPayload(
    payload('2026-11-01T00:00:00Z', [asiento(1, 'Pérez', 'Juan'), asiento(2, 'Gómez', 'Ana')]),
  )
  const snapshotNuevo = snapshotFromPayload(
    payload('2027-03-01T00:00:00Z', [asiento(1, 'López', 'Marta'), asiento(2, 'Gómez', 'Ana')]),
  )

  function acta(fecha: string) {
    return {
      fecha: day(fecha),
      votos: [{ diputado: 'Pérez, Juan' }, { diputado: 'López, Marta' }, { diputado: 'Gómez, Ana' }] as Array<{
        diputado: string
        banca?: number | null
      }>,
    }
  }

  it('congela la banca del snapshot vigente a la fecha del acta', () => {
    const a = acta('2026-11-03')
    expect(asignarBancasHistoricas([a], [snapshotViejo, snapshotNuevo])).toBe(1)
    expect(a.votos.map(v => v.banca)).toEqual([1, undefined, 2])
  })

  it('un acta posterior usa el recinto nuevo y el viejo queda intacto', () => {
    const viejo = acta('2026-11-03')
    const nuevo = acta('2027-03-02')
    asignarBancasHistoricas([viejo, nuevo], [snapshotViejo, snapshotNuevo])
    expect(viejo.votos[0]!.banca).toBe(1)
    expect(nuevo.votos[0]!.banca).toBeUndefined()
    expect(nuevo.votos[1]!.banca).toBe(1)
  })

  it('no pisa actas que ya tienen bancas', () => {
    const a = acta('2027-03-02')
    a.votos[0]!.banca = 99
    expect(asignarBancasHistoricas([a], [snapshotNuevo])).toBe(0)
    expect(a.votos[0]!.banca).toBe(99)
  })

  it('no asigna nada si el acta no está cerca de ningún scrape', () => {
    const a = acta('2025-03-19')
    expect(asignarBancasHistoricas([a], [snapshotViejo, snapshotNuevo])).toBe(0)
    expect(a.votos.every(v => v.banca === undefined)).toBe(true)
  })
})
