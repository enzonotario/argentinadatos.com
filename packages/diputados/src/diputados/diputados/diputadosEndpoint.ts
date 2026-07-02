import type { Diputado } from './crawlDiputados.ts'
import { readEndpoint } from '@argentinadatos/core/src/utils/readEndpoint.ts'
import { writeEndpoint } from '@argentinadatos/core/src/utils/writeEndpoint.ts'
import { collect } from 'collect.js'

export function getLegislaturaFromDiputado(diputado: Diputado): number {
  const inicio = diputado.periodoMandato?.inicio

  if (!inicio) {
    throw new Error(`Diputado ${diputado.id} sin periodoMandato.inicio`)
  }

  return Number(inicio.slice(0, 4))
}

export function readAllDiputados(): Diputado[] {
  const raw = readEndpoint('diputados/diputados')

  if (!raw) {
    return []
  }

  const parsed = JSON.parse(raw)

  if (
    Array.isArray(parsed)
    && parsed.length > 0
    && typeof parsed[0] === 'number'
  ) {
    return parsed.flatMap((legislatura: number) => {
      const shard = readEndpoint(`diputados/diputados/${legislatura}`)

      return shard ? JSON.parse(shard) as Diputado[] : []
    })
  }

  if (Array.isArray(parsed)) {
    return parsed as Diputado[]
  }

  return []
}

export function writeDiputadosEndpoints(diputados: Diputado[]): void {
  const legislaturas: number[] = []

  collect(diputados)
    .groupBy((diputado: Diputado) => getLegislaturaFromDiputado(diputado))
    .each((records, legislatura) => {
      const year = Number(legislatura)

      if (Number.isNaN(year)) {
        return
      }

      legislaturas.push(year)
      writeEndpoint(`diputados/diputados/${year}`, records.all())
    })

  legislaturas.sort((a, b) => a - b)
  writeEndpoint('diputados/diputados', legislaturas)
}
