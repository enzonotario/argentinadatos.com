export function apyToTna(apyDecimal, nPerYear) {
  if (!Number.isFinite(apyDecimal))
    throw new TypeError('apyDecimal debe ser un número finito')

  if (!Number.isFinite(nPerYear) || nPerYear <= 0)
    throw new TypeError('nPerYear debe ser mayor que 0')

  if (apyDecimal <= -1) throw new RangeError('apyDecimal debe ser mayor que -1')

  const rPeriod = Math.pow(1 + apyDecimal, 1 / nPerYear) - 1

  return rPeriod * nPerYear
}
