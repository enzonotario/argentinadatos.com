function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }
  }
  return undefined
}

function readNumberEnv(names, fallback) {
  const value = readEnv(...names)
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getIolCredentials() {
  const username = readEnv('IOL_USERNAME')
  const password = readEnv('IOL_PASSWORD')
  if (!username || !password) {
    throw new Error('Missing IOL_USERNAME or IOL_PASSWORD')
  }
  return { username, password }
}

export function getPocketBaseConfig() {
  const url = (
    readEnv('POCKETBASE_URL', 'VITE_POCKETBASE_URL') ||
    'https://db.argentinadatos.com'
  ).replace(/\/+$/, '')
  const token = readEnv('POCKETBASE_TOKEN', 'VITE_POCKETBASE_TOKEN')
  if (!token) {
    throw new Error('Missing POCKETBASE_TOKEN (o VITE_POCKETBASE_TOKEN)')
  }
  return { url, token }
}

export function getPollIntervalMs() {
  return readNumberEnv(
    ['WORKER_POLL_INTERVAL_MS', 'IOL_WORKER_POLL_INTERVAL_MS'],
    15 * 60 * 1000,
  )
}
