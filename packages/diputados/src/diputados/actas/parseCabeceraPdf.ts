import { PdfDataParser } from 'pdf-data-parser'
import { VOTACIONES_BASE_URL } from '../../constants.ts'

export function actaPdfUrl(actaId: string | number): string {
  return `${VOTACIONES_BASE_URL}/pdf/acta/${encodeURIComponent(String(actaId))}`
}

/** Campos de cabecera del PDF oficial de votación nominal. */
export interface ActaCabeceraPdf {
  votacion: string | null
  sesion: string | null
  baseMayoria: string | null
  tipoMayoria: string | null
  /** Compat UI: "Tipo — Base" o solo tipo. */
  mayoria: string | null
  miembros: number | null
  presentes: number | null
  sinVotar: number | null
  ultModVer: string | null
  /** Refuerzo si el HTML falló. */
  resultado: string | null
  presidente: string | null
}

function cell(row: string[], i: number): string {
  return String(row[i] ?? '').replace(/\s+/g, ' ').trim()
}

function joinRow(row: string[]): string {
  return row.map(c => String(c || '').trim()).filter(Boolean).join(' ')
}

function afterLabel(text: string, label: RegExp): string | null {
  const m = text.match(label)
  if (!m) return null
  const v = (m[1] || '').replace(/\s+/g, ' ').trim()
  return v || null
}

function parseIntLoose(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number.parseInt(String(value).replace(/\D+/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Interpreta las filas que devuelve PdfDataParser sobre el PDF de HCDN.
 * Exportado para tests con fixture (sin red).
 */
export function parseCabeceraFromPdfRows(rows: string[][]): ActaCabeceraPdf {
  const out: ActaCabeceraPdf = {
    votacion: null,
    sesion: null,
    baseMayoria: null,
    tipoMayoria: null,
    mayoria: null,
    miembros: null,
    presentes: null,
    sinVotar: null,
    ultModVer: null,
    resultado: null,
    presidente: null,
  }

  for (const row of rows) {
    const line = joinRow(row)
    if (!line) continue

    if (/votaci[oó]n\s+nominal/i.test(line) && !out.votacion) {
      out.votacion = 'Nominal'
    }

    if (
      !out.sesion
      && /\d+°\s*-\s*Per[ií]odo/i.test(line)
      && /Reuni[oó]n/i.test(line)
    ) {
      out.sesion = line
    }

    if (/Acta\s*N/i.test(line) || /Ult\.?\s*Mod/i.test(line)) {
      out.ultModVer
        = afterLabel(line, /Ult\.?\s*Mod\.?\s*Ver\s*[:\s]*([0-9]+)/i)
        || out.ultModVer
    }

    // A veces PdfDataParser pega "Tipo Mayoría:Más de la mitad" sin espacio.
    const base
      = afterLabel(line, /Base\s+Mayor[ií]a\s*:\s*([^:]+?)(?=\s*Tipo\s+Mayor|\s*Miembros|$)/i)
      || afterLabel(joinRow(row), /Base\s+Mayor[ií]a\s*:\s*(.+)$/i)
    if (base && !out.baseMayoria) {
      // Puede venir "Votos Emitidos Votos Emitidos" duplicado
      out.baseMayoria = base
        .replace(/\b(Votos Emitidos)\s+\1\b/i, '$1')
        .replace(/\s+Tipo\s+Mayor.*$/i, '')
        .trim()
    }

    const tipo
      = afterLabel(line, /Tipo\s+Mayor[ií]a\s*:\s*([^:]+?)(?=\s*Miembros|$)/i)
    if (tipo && !out.tipoMayoria) {
      out.tipoMayoria = tipo
        .replace(/\b(Más de la mitad)\s+\1\b/i, '$1')
        .replace(/\s*Miembros.*$/i, '')
        .trim()
    }

    const miembros = afterLabel(line, /Miembros\s+del\s+Cuerpo\s*:\s*(\d+)/i)
    if (miembros) out.miembros = parseIntLoose(miembros)

    const resultado = afterLabel(
      line,
      /Resultado\s+de\s+Votaci[oó]n\s*:\s*([A-ZÁÉÍÓÚÜÑ]+)/i,
    )
    if (resultado) out.resultado = resultado.toLowerCase()

    const presidente = afterLabel(line, /Presidente\s*:\s*(.+)$/i)
    if (presidente) {
      out.presidente = presidente
        .replace(/\b(MENEM, MARTIN)\s+\1\b/i, '$1')
        .trim()
    }

    // Presentes | votando | sinVotar | total | ...
    if (/^Presentes$/i.test(cell(row, 0)) || /^Presentes\b/i.test(line)) {
      // Prefer structured cells when available
      if (row.length >= 4 && /^\d+$/.test(cell(row, 3))) {
        out.presentes = parseIntLoose(cell(row, 3))
        out.sinVotar = parseIntLoose(cell(row, 2))
      }
      else {
        const nums = line.match(/\d+/g) || []
        // Presentes 220 1 221 ...
        if (nums.length >= 3) {
          out.sinVotar = parseIntLoose(nums[1]!)
          out.presentes = parseIntLoose(nums[2]!)
        }
      }
    }
  }

  if (out.tipoMayoria || out.baseMayoria) {
    out.mayoria = [out.tipoMayoria, out.baseMayoria].filter(Boolean).join(' — ')
  }

  return out
}

export async function fetchActaPdfRows(actaId: string): Promise<string[][]> {
  const url = actaPdfUrl(actaId)
  const parser = new PdfDataParser({ url })
  const data = await parser.parse()
  if (!Array.isArray(data)) return []
  return data as string[][]
}

export async function parseCabeceraPdf(actaId: string): Promise<ActaCabeceraPdf | null> {
  try {
    const rows = await fetchActaPdfRows(actaId)
    if (!rows.length) return null
    return parseCabeceraFromPdfRows(rows)
  }
  catch (e: any) {
    console.warn(
      `Cabecera PDF acta ${actaId}:`,
      e?.message || e,
    )
    return null
  }
}
