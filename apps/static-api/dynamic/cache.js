const store = new Map()

/**
 * @param {string} key
 * @param {{ allowStale?: boolean }} [opts]
 */
export function getCached(key, { allowStale = false } = {}) {
  const entry = store.get(key)
  if (!entry) return null
  if (!allowStale && Date.now() > entry.expiresAt) {
    return null
  }
  return entry.value
}

export function setCached(key, value, ttlMs) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  })
}

/** Solo para tests. */
export function clearCache() {
  store.clear()
}
