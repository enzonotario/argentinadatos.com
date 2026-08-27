import { describe, expect, it } from 'vitest'
import { parseCabeceraFromPdfRows } from '../src/diputados/actas/parseCabeceraPdf.ts'

/** Filas reales de PdfDataParser sobre el PDF de la acta 5995. */
const FIXTURE_ROWS: string[][] = [
  ['Honorable Cámara de Diputados de la Nación', 'Honorable Cámara de Diputados de la Nación'],
  ['Votación Nominal', 'Votación Nominal'],
  ['144° - Período Ordinario - 5° Sesión Especial - 6° Reunión'],
  ['O.D. 207 - "LEY JOAQUÍN", OBLIGATORIEDAD DE MEDIDAS DE SEGURIDAD EN EL DEPORTE Y ACTIVIDADES RECREATIVAS. ESTABLECIMIENTO. VOT. EN GRAL. Y PART.'],
  ['Acta Nº 29', 'Ult.Mod.Ver 1', 'Fecha: 27/08/2026', 'Hora: 03:46'],
  ['Base Mayoría:', 'Votos Emitidos', 'Votos Emitidos', 'Tipo Mayoría:Más de la mitad', 'Más de la mitad', 'Miembros del Cuerpo: 257'],
  ['Resultado de Votación:AFIRMATIVO', 'AFIRMATIVO', 'Presidente:MENEM, MARTIN', 'MENEM, MARTIN'],
  ['Votando', 'Sin votar', 'Total', 'Diputados', 'Presidente', 'Desempate', 'Total'],
  ['Presentes', '220', '1', '221', 'Afirmativos', '220', '0', '0', '220'],
  ['Ausentes', '36', 'Negativos', '0', '0', '0', '0'],
  ['Abstenciones', '0', '0', '0'],
]

describe('parseCabeceraFromPdfRows', () => {
  it('extrae cabecera de votación nominal HCDN', () => {
    const c = parseCabeceraFromPdfRows(FIXTURE_ROWS)
    expect(c.votacion).toBe('Nominal')
    expect(c.sesion).toMatch(/Período Ordinario/)
    expect(c.sesion).toMatch(/Sesión Especial/)
    expect(c.baseMayoria).toMatch(/Votos Emitidos/i)
    expect(c.tipoMayoria).toMatch(/Más de la mitad/i)
    expect(c.mayoria).toContain('Más de la mitad')
    expect(c.miembros).toBe(257)
    expect(c.presentes).toBe(221)
    expect(c.sinVotar).toBe(1)
    expect(c.ultModVer).toBe('1')
    expect(c.resultado).toBe('afirmativo')
    expect(c.presidente).toMatch(/MENEM/i)
  })
})
