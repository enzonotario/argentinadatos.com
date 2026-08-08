import { parseCabecera } from './parseCabecera.ts'
import { parseVotos } from './parseVotos.ts'

export enum VotoEnum {
  Si = 'si',
  No = 'no',
  Ausente = 'ausente',
  Abstencion = 'abstencion',
  NoEmite = 'no emite',
  LevVot = 'lev.vot.',
  Desconocido = 'desconocido',
}

export enum ResultadoEnum {
  Afirmativa = 'afirmativa',
  Negativa = 'negativa',
  CanceladaLevVot = 'cancelada lev.vot.',
}

export interface VotoData {
  nombre: string
  voto: VotoEnum | string
  banca: string
}

export interface ActaData {
  actaId?: number
  titulo?: string
  proyecto: string
  descripcion: string
  quorumTipo: string
  fecha: string
  acta: string
  mayoria: string
  /** Tipo de votación (p. ej. NOMINAL). */
  votacion?: string
  /** Presidente según cabecera del PDF. */
  presidente?: string
  miembros: number
  afirmativos: number
  negativos: number
  abstenciones: number
  presentes: number
  ausentes: number
  amn: number
  resultado: ResultadoEnum | string
  votos: VotoData[]
  observaciones: string[]
}

export async function parseActa(
  actaId: number,
  titulo: string,
  pdfPath: string,
): Promise<ActaData> {
  const acta = {
    actaId,
    titulo,
    ...(await parseCabecera(pdfPath)),
    votos: await parseVotos(pdfPath),
  }

  // if (!validateActa(acta)) {
  //   throw new Error(`❌ Acta ${actaId} no es válida`)
  // }

  return acta
}

// function validateActa(acta: ActaData): boolean {
//   const totalVotos = acta.afirmativos + acta.negativos + acta.abstenciones
//
//   if (totalVotos !== acta.presentes) {
//     console.log(
//       `❌ Acta ${acta.actaId} no es válida: votos (${totalVotos}) != presentes (${acta.presentes})`,
//     )
//     return false
//   }
//
//   if (
//     acta.votos.filter(voto => voto.voto === 'si').length !== acta.afirmativos
//   ) {
//     console.log(
//       `❌ Acta ${acta.actaId} no es válida: votos afirmativos (${acta.afirmativos}) no coinciden`,
//     )
//     return false
//   }
//
//   if (acta.votos.filter(voto => voto.voto === 'no').length !== acta.negativos) {
//     console.log(
//       `❌ Acta ${acta.actaId} no es válida: votos negativos (${acta.negativos}) no coinciden`,
//     )
//     return false
//   }
//
//   if (
//     acta.votos.filter(voto => voto.voto === 'ausente').length !== acta.ausentes
//   ) {
//     console.log(
//       `❌ Acta ${acta.actaId} no es válida: votos ausentes (${acta.ausentes}) no coinciden`,
//     )
//     return false
//   }
//
//   return true
// }
