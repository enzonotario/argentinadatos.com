import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../..',
)

export function loadStaticClassIdToFondoIdMap(
  indexPath = resolve(
    repositoryRoot,
    'datos/v1/finanzas/fci/fondos/index.json',
  ),
) {
  const map = new Map()

  if (!existsSync(indexPath)) {
    return map
  }

  try {
    const payload = JSON.parse(readFileSync(indexPath, 'utf8'))
    const fondos = Array.isArray(payload) ? payload : payload.fondos || []

    for (const fondo of fondos) {
      if (fondo?.claseId && fondo?.fondoId) {
        map.set(String(fondo.claseId), String(fondo.fondoId))
      }
    }
  } catch {
    return map
  }

  return map
}

export function mergeClassIdMaps(...maps) {
  const merged = new Map()

  for (const map of maps) {
    for (const [classId, fondoId] of map.entries()) {
      merged.set(String(classId), String(fondoId))
    }
  }

  return merged
}
