import type { VotoData } from './parseActa.ts'
import { getVotoEnum } from './votoUtils.ts'

/**
 * Formato histórico de actas del Senado:
 * Nombre Completo / Voto / Banca
 * 1.   Apellido, Nombre
 * SI
 * 44
 */
export function parseVotosConBanca(lines: string[]): VotoData[] {
  const row: VotoData[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\d+\./.test(line)) {
      const nombre = line.replace(/^\d+\.\s+/, '')
      const voto = getVotoEnum(lines[i + 1].toLowerCase())

      if (voto.toLowerCase() === 'ausente') {
        row.push({ nombre, voto, banca: '' })
      }
      else {
        const banca = lines[i + 2]
        row.push({ nombre, voto, banca })
      }
    }
  }

  return row
}
