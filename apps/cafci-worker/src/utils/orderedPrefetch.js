/**
 * Prefetch ordenado: arranca hasta `concurrency` cargas adelantadas,
 * pero `take(index)` entrega resultados en orden (0, 1, 2, ...).
 */
export function createOrderedPrefetch(count, concurrency, load) {
  const inflight = new Map()
  const limit = Math.max(1, concurrency)

  function kick(index) {
    if (index < 0 || index >= count || inflight.has(index)) {
      return
    }

    inflight.set(
      index,
      Promise.resolve()
        .then(() => load(index))
        .then(
          value => ({ ok: true, value }),
          error => ({ ok: false, error }),
        ),
    )
  }

  return {
    async take(index) {
      for (
        let ahead = index;
        ahead < Math.min(count, index + limit);
        ahead += 1
      ) {
        kick(ahead)
      }

      const result = await inflight.get(index)
      inflight.delete(index)

      if (!result.ok) {
        throw result.error
      }

      return result.value
    },
  }
}
