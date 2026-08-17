import { describe, expect, it } from 'vitest'
import { createOrderedPrefetch } from '../../../apps/cafci-worker/src/utils/orderedPrefetch.js'
import { sleep } from '../../../apps/cafci-worker/src/utils/sleep.js'

describe('createOrderedPrefetch', () => {
  it('entrega resultados en orden aunque las cargas terminen desordenadas', async () => {
    const started = []
    const prefetch = createOrderedPrefetch(4, 3, async index => {
      started.push(index)
      await sleep((4 - index) * 15)
      return index * 10
    })

    const first = prefetch.take(0)
    await sleep(5)
    expect(started).toEqual([0, 1, 2])

    expect(await first).toBe(0)
    expect(await prefetch.take(1)).toBe(10)
    expect(await prefetch.take(2)).toBe(20)
    expect(await prefetch.take(3)).toBe(30)
  })
})
