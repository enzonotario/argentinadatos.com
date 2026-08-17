import { sleep } from './sleep.js'

export async function withRetry(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error

      if (attempt < attempts) {
        await sleep(delayMs * attempt)
      }
    }
  }

  throw lastError
}
