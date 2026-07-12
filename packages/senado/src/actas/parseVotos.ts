import type { VotoData } from './parseActa.ts'
import type { VotosParser } from './votoUtils.ts'
import { readStaticBuffer } from '@argentinadatos/core/src/utils/readStaticBuffer.ts'
import { pdfToText } from 'pdf-ts'
import { parseVotosConBanca } from './parseVotosConBanca.ts'
import { parseVotosSinBanca } from './parseVotosSinBanca.ts'
import { stripVoteHeaders } from './votoUtils.ts'

async function extract(pdfPath: string): Promise<string> {
  const dataBuffer = readStaticBuffer(pdfPath)

  if (!dataBuffer) {
    throw new Error(`No se pudo leer el archivo ${pdfPath}`)
  }

  return await pdfToText(dataBuffer)
}

function detectVotosParser(lines: string[], headerIndex: number): VotosParser {
  if (lines[headerIndex + 2] === 'Banca') {
    return parseVotosConBanca
  }

  return parseVotosSinBanca
}

function votesStartOffset(lines: string[], headerIndex: number): number {
  return lines[headerIndex + 2] === 'Banca' ? headerIndex + 3 : headerIndex + 2
}

export async function parseVotos(pdfPath: string): Promise<VotoData[]> {
  const text = await extract(pdfPath)
  const lines = text.split('\n').map(line => line.trim())

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== 'Nombre Completo' || lines[i + 1] !== 'Voto') {
      continue
    }

    const parser = detectVotosParser(lines, i)
    const votesLines = stripVoteHeaders(lines.slice(votesStartOffset(lines, i)))

    return parser(votesLines)
  }

  return []
}
