const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
])

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isRetryablePocketBaseError(error) {
  const code = error?.code || error?.cause?.code
  if (code && TRANSIENT_NETWORK_CODES.has(code)) return true

  const status = error?.response?.status
  return typeof status === 'number' && TRANSIENT_HTTP_STATUSES.has(status)
}

export async function withRetry(
  fn,
  {
    attempts = 4,
    delayMs = 750,
    shouldRetry = isRetryablePocketBaseError,
  } = {},
) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error

      if (attempt >= attempts || !shouldRetry(error)) {
        throw error
      }

      await sleep(delayMs * attempt)
    }
  }

  throw lastError
}
