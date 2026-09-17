function readEnv(...names) {
  for (const name of names) {
    const value =
      (typeof import.meta !== 'undefined' && import.meta.env?.[name]) ||
      process.env[name]
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }
  }
  return undefined
}

/**
 * Config PocketBase desde entorno.
 * Preferencia: VITE_POCKETBASE_* (canónico) → POCKETBASE_* (legacy).
 */
export function getPocketBaseConfig(overrides = {}) {
  const url = (
    overrides.url ||
    readEnv('VITE_POCKETBASE_URL', 'POCKETBASE_URL') ||
    'https://db.argentinadatos.com'
  ).replace(/\/+$/, '')
  const token =
    overrides.token ||
    readEnv('VITE_POCKETBASE_TOKEN', 'POCKETBASE_TOKEN')
  if (!token) {
    throw new Error('Missing VITE_POCKETBASE_TOKEN (o POCKETBASE_TOKEN)')
  }
  return { url, token }
}

/**
 * Igual que getPocketBaseConfig, pero `null` si no hay token
 * (scrapers opcionales: no fallar si no está configurado).
 */
export function tryGetPocketBaseConfig(overrides = {}) {
  try {
    return getPocketBaseConfig(overrides)
  }
  catch {
    return null
  }
}

/**
 * Resuelve cliente PB:
 * - `file:` / `memory:` → store en memoria (tests)
 * - url+token HTTP explícitos → ese PB
 * - sin args → VITE_POCKETBASE_* / POCKETBASE_* de entorno
 */
export function shouldUseMemoryBackend(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('file:') || url.startsWith('memory:'))
  )
}
