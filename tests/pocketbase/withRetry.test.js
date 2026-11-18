import { describe, expect, it, vi } from 'vitest'
import {
  isRetryablePocketBaseError,
  withRetry,
} from '../../packages/pocketbase/src/withRetry.js'

describe('isRetryablePocketBaseError', () => {
  it('retries ECONNRESET and nested cause codes', () => {
    expect(isRetryablePocketBaseError({ code: 'ECONNRESET' })).toBe(true)
    expect(isRetryablePocketBaseError({ cause: { code: 'ECONNRESET' } })).toBe(
      true,
    )
  })

  it('retries transient HTTP statuses', () => {
    expect(isRetryablePocketBaseError({ response: { status: 503 } })).toBe(true)
  })

  it('does not retry client errors', () => {
    expect(isRetryablePocketBaseError({ response: { status: 400 } })).toBe(
      false,
    )
    expect(isRetryablePocketBaseError({ code: 'ERR_BAD_REQUEST' })).toBe(false)
  })
})

describe('withRetry', () => {
  it('retries transient failures then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
      )
      .mockResolvedValueOnce('ok')

    await expect(withRetry(fn, { attempts: 4, delayMs: 1 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stops immediately on non-retryable errors', async () => {
    const error = Object.assign(new Error('bad'), {
      response: { status: 400 },
    })
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withRetry(fn, { attempts: 4, delayMs: 1 })).rejects.toBe(error)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting attempts', async () => {
    const error = Object.assign(new Error('reset'), { code: 'ECONNRESET' })
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withRetry(fn, { attempts: 3, delayMs: 1 })).rejects.toBe(error)
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
