import parseDecimalNumber from 'parse-decimal-number'

export function interpretarDecimalConComa(valor) {
  return parseDecimalNumber(valor, '.,')
}
