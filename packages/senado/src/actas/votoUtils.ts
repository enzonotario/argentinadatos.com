import type { VotoData } from './parseActa.ts'
import { VotoEnum } from './parseActa.ts'

export const HEADER_LINES = new Set(['Nombre Completo', 'Voto', 'Banca'])

export const VOTE_LINE_RE = /^(si|no|ausente|abs\.|no emit\.|lev\.vot\.)$/i

export function getVotoEnum(voto: string): VotoEnum | string {
  switch (voto) {
    case 'si':
      return VotoEnum.Si
    case 'no':
      return VotoEnum.No
    case 'ausente':
      return VotoEnum.Ausente
    case 'abs.':
      return VotoEnum.Abstencion
    case 'no emit.':
      return VotoEnum.NoEmite
    case 'lev.vot.':
      return VotoEnum.LevVot
    default:
      console.warn(`Voto desconocido: ${voto}`)
      return voto
  }
}

export function stripVoteHeaders(lines: string[]): string[] {
  return lines.filter(line => !HEADER_LINES.has(line))
}

export type VotosParser = (lines: string[]) => VotoData[]
