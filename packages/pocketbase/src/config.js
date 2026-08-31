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

export function getPocketBaseConfig(overrides = {}) {
  const url = (
    overrides.url ||
    readEnv('POCKETBASE_URL') ||
    'https://db.argentinadatos.com'
  ).replace(/\/+$/, '')
  const token = overrides.token || readEnv('POCKETBASE_TOKEN')
  if (!token) {
    throw new Error('Missing POCKETBASE_TOKEN')
  }
  return { url, token }
}

/**
 * Resuelve cliente PB:
 * - `file:` / `memory:` → store en memoria (tests)
 * - url+token HTTP explícitos → ese PB
 * - sin args / libsql/turso → POCKETBASE_* de entorno
 */
export function shouldUseMemoryBackend(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('file:') || url.startsWith('memory:'))
  )
}
