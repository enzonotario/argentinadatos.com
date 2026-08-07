import { titleCaseSpanish } from '@argentinadatos/core/src/utils/titleCaseSpanish.ts'

export const SENADORES_VIGENTES_JSON_URL
  = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoSenadores/json'

export interface SenadorVigenteRow {
  id: string
  bloque: string
  apellido: string
  nombre: string
  provincia: string
  partido: string
}

export async function downloadSenadoresVigentes(): Promise<SenadorVigenteRow[]> {
  const response = await fetch(SENADORES_VIGENTES_JSON_URL)
  if (!response.ok) {
    throw new Error(`Senadores vigentes: HTTP ${response.status}`)
  }
  const json = await response.json()
  const rows = json?.table?.rows
  if (!Array.isArray(rows)) {
    throw new Error('Senadores vigentes: respuesta sin table.rows')
  }

  return rows.map((row: any) => ({
    id: String(row.ID),
    bloque: String(row.BLOQUE || '').trim(),
    apellido: String(row.APELLIDO || '').trim(),
    nombre: String(row.NOMBRE || '').trim(),
    provincia: String(row.PROVINCIA || '').trim(),
    partido: String(row['PARTIDO O ALIANZA'] || '').trim(),
  })).filter((row: SenadorVigenteRow) => row.id)
}

/**
 * Aplica el bloque parlamentario oficial a todos los mandatos del mismo id.
 * Fuente: ExportarListadoSenadores (vigentes).
 */
export function applyBloquesToSenadores<T extends { id: string, bloque?: string | null }>(
  senadores: T[],
  vigentes: SenadorVigenteRow[],
): { senadores: T[], matchedIds: string[] } {
  const bloquePorId = new Map<string, string>()
  for (const v of vigentes) {
    if (v.bloque) {
      bloquePorId.set(v.id, titleCaseSpanish(v.bloque.toLowerCase()))
    }
  }

  const matchedIds: string[] = []
  for (const senador of senadores) {
    const bloque = bloquePorId.get(String(senador.id)) || null
    senador.bloque = bloque
    if (bloque && !matchedIds.includes(String(senador.id))) {
      matchedIds.push(String(senador.id))
    }
  }

  return { senadores, matchedIds }
}
