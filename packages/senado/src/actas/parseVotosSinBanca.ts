import type { VotoData } from './parseActa.ts'
import { VOTE_LINE_RE, getVotoEnum } from './votoUtils.ts'

/**
 * Formato nuevo de actas del Senado (~2026):
 * Nombre Completo / Voto (sin Banca ni numeración)
 * Apellido, Nombre
 * SI
 */
export function parseVotosSinBanca(lines: string[]): VotoData[] {
  const row: VotoData[] = []

  for (let i = 0; i < lines.length; i += 2) {
    const nombre = lines[i]
    const votoLine = lines[i + 1]

    // Pie del PDF: "Proyecto:", "Fecha:", etc.
    if (!nombre || nombre.endsWith(':')) {
      break
    }

    if (!votoLine || !VOTE_LINE_RE.test(votoLine)) {
      break
    }

    row.push({
      nombre,
      voto: getVotoEnum(votoLine.toLowerCase()),
      banca: '',
    })
  }

  return row
}
