/**
 * Normaliza nombres de FCI para matchear catálogo CNV ↔ payloads internos.
 * Quita clase, FCI, sufijos "Ex …", "Fondo de Dinero", etc.
 */
export function normalizeFciName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bex\b[\s.].*$/i, ' ')
    .replace(/\bf\.?\s*c\.?\s*i\.?\b/g, ' ')
    .replace(
      /\bfondo(?:s)?\s+(?:comun(?:es)?\s+de\s+inversion|de\s+dinero)\b/g,
      ' ',
    )
    .replace(/\bclase\s+[a-z0-9]+/gi, ' ')
    .replace(/\$/g, ' pesos ')
    .replace(/\bdolares?\b/g, 'dolar')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Busca el id DetallesFCI del catálogo CNV para un nombre de fondo/clase.
 * @param {string} fundName
 * @param {Array<{ Text: string, Value: string}>} catalog
 * @returns {{ id: string, text: string, score: number } | null}
 */
export function matchDetallesFciId(fundName, catalog) {
  const target = normalizeFciName(fundName)

  if (!target || !Array.isArray(catalog) || catalog.length === 0) {
    return null
  }

  const indexed = catalog
    .map(item => ({
      id: String(item.Value ?? item.id ?? ''),
      text: String(item.Text ?? item.text ?? item.nombre ?? ''),
      normalized: normalizeFciName(item.Text ?? item.text ?? item.nombre ?? ''),
    }))
    .filter(item => item.id && item.normalized)

  const exact = indexed.find(item => item.normalized === target)
  if (exact) {
    return { id: exact.id, text: exact.text, score: 1 }
  }

  const candidates = indexed
    .map(item => {
      const { normalized } = item
      let score = 0

      if (
        normalized.startsWith(`${target} `) ||
        target.startsWith(`${normalized} `)
      ) {
        score = 0.9
      } else if (
        normalized.includes(` ${target} `) ||
        target.includes(` ${normalized} `)
      ) {
        score = 0.75
      } else if (normalized.includes(target) || target.includes(normalized)) {
        score = 0.6
      }

      if (score === 0) {
        return null
      }

      const lengthPenalty =
        Math.abs(normalized.length - target.length) /
        Math.max(normalized.length, target.length, 1)

      return {
        id: item.id,
        text: item.text,
        score: score - lengthPenalty * 0.2,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]
  if (!best || best.score < 0.5) {
    return null
  }

  return best
}
